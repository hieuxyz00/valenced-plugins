import { Dispatcher } from '@valenced/discord/common/flux'
import { Stores } from '@valenced/discord/flux'
import { after, instead } from '@valenced/patcher'
import SettingsComponent from './settings'
import { DefaultBypassSettings } from './types'
import type {
	AgeVerificationStoreType,
	BypassSettings,
	DiscordUser,
	FluxAction,
	FluxDispatcherType,
	GatedChannelStoreType,
	GuildNSFWAgreeStoreType,
	RegionalFeatureConfigStoreType,
	UserStoreType,
} from './types'

const BLOCKED_DISPATCH_ACTIONS = new Set<string>([
	'AGE_GATE_MODAL_OPEN',
	'INITIATE_AGE_VERIFICATION',
	'AGE_GATE_LOGOUT_UNDERAGE_NEW_USER',
	'CLOSE_AGE_VERIFICATION_MODAL',
])

function mutateUserAdultStatus(user: unknown): void {
	if (typeof user !== 'object' || user === null) return
	const u = user as DiscordUser
	u.nsfwAllowed = true
	if (u.ageVerificationStatus === undefined || u.ageVerificationStatus < 4) {
		u.ageVerificationStatus = 4
	}
}

export function patchBypassNSFWGate(
	cleanup: (cb: () => void) => void,
	getSettings: () => BypassSettings,
): void {
	const userStore = Stores?.UserStore as unknown as UserStoreType | undefined
	if (typeof userStore?.getCurrentUser === 'function') {
		cleanup(
			after(
				userStore,
				'getCurrentUser',
				(user: DiscordUser | null | undefined) => {
					const settings = getSettings()
					if (!settings.forceAdultStatus) return user
					mutateUserAdultStatus(user)
					return user
				},
			),
		)

		if (typeof userStore.getUser === 'function') {
			cleanup(
				after(userStore, 'getUser', (user: DiscordUser | null | undefined) => {
					const settings = getSettings()
					if (!settings.forceAdultStatus) return user
					const current = userStore.getCurrentUser?.()
					if (
						user &&
						typeof user === 'object' &&
						current &&
						user.id === current.id
					) {
						mutateUserAdultStatus(user)
					}
					return user
				}),
			)
		}
	}

	const gatedChannelStore = Stores?.GatedChannelStore as unknown as
		| GatedChannelStoreType
		| undefined
	if (typeof gatedChannelStore?.isChannelGated === 'function') {
		cleanup(
			instead(gatedChannelStore, 'isChannelGated', function (args, original) {
				const settings = getSettings()
				if (settings.bypassChannelGate) return false
				return Reflect.apply(original, this, args) as boolean
			}),
		)
	}

	if (typeof gatedChannelStore?.isChannelGatedAndVisible === 'function') {
		cleanup(
			instead(
				gatedChannelStore,
				'isChannelGatedAndVisible',
				function (args, original) {
					const settings = getSettings()
					if (settings.bypassChannelGate) return false
					return Reflect.apply(original, this, args) as boolean
				},
			),
		)
	}

	if (typeof gatedChannelStore?.isChannelOrThreadParentGated === 'function') {
		cleanup(
			instead(
				gatedChannelStore,
				'isChannelOrThreadParentGated',
				function (args, original) {
					const settings = getSettings()
					if (settings.bypassChannelGate) return false
					return Reflect.apply(original, this, args) as boolean
				},
			),
		)
	}

	const guildAgreeStore = Stores?.GuildNSFWAgreeStore as unknown as
		| GuildNSFWAgreeStoreType
		| undefined
	if (typeof guildAgreeStore?.didAgree === 'function') {
		cleanup(
			instead(guildAgreeStore, 'didAgree', function (args, original) {
				const settings = getSettings()
				if (settings.bypassGuildGate) return true
				return Reflect.apply(original, this, args) as boolean
			}),
		)
	}

	const ageVerificationStore = Stores?.AgeVerificationStore as unknown as
		| AgeVerificationStoreType
		| undefined
	if (typeof ageVerificationStore?.getReactiveCheckPassed === 'function') {
		cleanup(
			instead(
				ageVerificationStore,
				'getReactiveCheckPassed',
				function (args, original) {
					const settings = getSettings()
					if (settings.bypassAgeVerification) return true
					return Reflect.apply(original, this, args) as boolean
				},
			),
		)
	}

	if (typeof ageVerificationStore?.shouldCallReactiveCheck === 'function') {
		cleanup(
			instead(
				ageVerificationStore,
				'shouldCallReactiveCheck',
				function (args, original) {
					const settings = getSettings()
					if (settings.bypassAgeVerification) return false
					return Reflect.apply(original, this, args) as boolean
				},
			),
		)
	}

	if (typeof ageVerificationStore?.getReactiveCheckStatus === 'function') {
		cleanup(
			instead(
				ageVerificationStore,
				'getReactiveCheckStatus',
				function (args, original) {
					const settings = getSettings()
					if (settings.bypassAgeVerification) return 'passed'
					return Reflect.apply(original, this, args) as string
				},
			),
		)
	}

	if (typeof ageVerificationStore?.getReactiveCheckMiss === 'function') {
		cleanup(
			instead(
				ageVerificationStore,
				'getReactiveCheckMiss',
				function (args, original) {
					const settings = getSettings()
					if (settings.bypassAgeVerification) return false
					return Reflect.apply(original, this, args) as boolean
				},
			),
		)
	}

	const regionalStore = Stores?.RegionalFeatureConfigStore as unknown as
		| RegionalFeatureConfigStoreType
		| undefined
	if (typeof regionalStore?.hasAgeGatedFeatures === 'function') {
		cleanup(
			instead(regionalStore, 'hasAgeGatedFeatures', function (args, original) {
				const settings = getSettings()
				if (settings.bypassAgeVerification) return false
				return Reflect.apply(original, this, args) as boolean
			}),
		)
	}

	if (typeof regionalStore?.isFeatureAgeGated === 'function') {
		cleanup(
			instead(regionalStore, 'isFeatureAgeGated', function (args, original) {
				const settings = getSettings()
				if (settings.bypassAgeVerification) return false
				return Reflect.apply(original, this, args) as boolean
			}),
		)
	}

	const dispatcher = Dispatcher as unknown as FluxDispatcherType | undefined
	if (typeof dispatcher?.dispatch === 'function') {
		cleanup(
			instead(dispatcher, 'dispatch', function (args, original) {
				const [action] = args as [FluxAction | undefined]
				const settings = getSettings()
				if (
					settings.bypassAgeVerification &&
					action?.type &&
					BLOCKED_DISPATCH_ACTIONS.has(action.type)
				) {
					return
				}
				return Reflect.apply(original, this, args)
			}),
		)
	}
}

export default plugin<{ jsonStorage: BypassSettings }>({
	jsonStorage: { load: true, default: DefaultBypassSettings },
	start({ cleanup, jsonStorage: storage }) {
		const getSettings = (): BypassSettings => ({
			...DefaultBypassSettings,
			...(storage.get() as Partial<BypassSettings> | undefined),
		})

		patchBypassNSFWGate(cleanup, getSettings)
	},
	SettingsComponent,
})
