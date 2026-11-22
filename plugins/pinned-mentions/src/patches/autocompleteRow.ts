import TableRowAssetIcon from '@valenced/components/TableRowAssetIcon'
import { getModules, lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import React, {
	cloneElement,
	createElement,
	isValidElement,
	useEffect,
	useState,
} from 'react'
import { Vibration, View } from 'react-native'
import {
	emitPinChange,
	getActiveScopeId,
	isUserPinned,
	subscribePinChange,
	togglePinUser,
} from '../utils/storage'
import { showToast } from '../utils/toast'
import type { JsonStorage } from '@valenced/json-storage'
import type { ReactElement, ReactNode } from 'react'
import type {
	AutocompleteUserProps,
	MentionQueryItemUser,
	Settings,
} from '../types'

interface TargetRowModule {
	User: (props: AutocompleteUserProps) => ReactElement | null
	Role?: unknown
	Channel?: unknown
	Emoji?: unknown
}

interface AutocompleteRowsModule {
	User?: (props: AutocompleteUserProps) => ReactElement | null
	Role?: unknown
	Channel?: unknown
	Emoji?: unknown
	default?: {
		User?: (props: AutocompleteUserProps) => ReactElement | null
		Role?: unknown
		Channel?: unknown
		Emoji?: unknown
	}
}

const patchedRowTargets = new WeakSet<object>()

function hasReactDispatcher(): boolean {
	try {
		const internals = React as unknown as {
			__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: {
				H?: { useState?: { name?: string } }
			}
			__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: {
				ReactCurrentDispatcher?: { current?: { useState?: { name?: string } } }
			}
		}
		const cliH =
			internals.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
				?.H
		if (cliH) {
			const name = cliH.useState?.name || ''
			return (
				!name.includes('throwInvalidHookError') && !name.includes('InvalidHook')
			)
		}
		const secDisp =
			internals.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
				?.ReactCurrentDispatcher?.current
		if (secDisp) {
			const name = secDisp.useState?.name || ''
			return (
				!name.includes('throwInvalidHookError') && !name.includes('InvalidHook')
			)
		}
		return false
	} catch {
		return false
	}
}

export function patchAutocompleteRow(
	cleanup: (fn: () => void) => void,
	jsonStorage: JsonStorage<Settings>,
): void {
	const applyPatchToRowModule = (mod: AutocompleteRowsModule | undefined) => {
		if (!mod) return

		let target: TargetRowModule | undefined

		if (typeof mod.User === 'function') {
			target = mod as unknown as TargetRowModule
		} else if (typeof mod.default?.User === 'function') {
			target = mod.default as unknown as TargetRowModule
		}

		if (!target || patchedRowTargets.has(target)) return
		patchedRowTargets.add(target)

		const unpatch = instead(target, 'User', function (args, orig) {
			const props = (args[0] ?? {}) as AutocompleteUserProps
			const user: MentionQueryItemUser | undefined =
				props.user || props.item?.user
			const userId = user?.id

			let override: { id: string; pinned: boolean } | null = null
			let setOverride:
				| ((val: { id: string; pinned: boolean } | null) => void)
				| undefined

			if (hasReactDispatcher()) {
				try {
					const hookState = useState<{ id: string; pinned: boolean } | null>(
						null,
					)
					override = hookState[0]
					setOverride = hookState[1]
				} catch {}

				try {
					useEffect(() => {
						if (!userId) return
						return subscribePinChange((changedId, newPinned) => {
							if (changedId === userId && typeof setOverride === 'function') {
								setOverride({ id: userId, pinned: newPinned })
							}
						})
					}, [userId])
				} catch {}
			}

			const rendered = Reflect.apply(orig, this, args) as ReactElement | null
			if (!rendered || !isValidElement(rendered)) return rendered

			const settings = jsonStorage.cache as
				| (Settings & {
						longPressPinsGlobally?: boolean
						enableHaptics?: boolean
				  })
				| undefined
			if (!settings?.enabled || !userId) return rendered

			const scopeId = getActiveScopeId()
			if (settings.disableInDms && scopeId === 'global') return rendered

			const basePinned = isUserPinned(settings, scopeId, userId)
			const isPinned =
				override && override.id === userId ? override.pinned : basePinned
			const isGlobalTarget =
				scopeId === 'global' ||
				settings.longPressTarget === 'global' ||
				settings.longPressPinsGlobally === true
			const targetScope = isGlobalTarget ? 'global' : scopeId

			const handleLongPress = () => {
				const nextPinned = !isPinned
				if (typeof setOverride === 'function') {
					setOverride({ id: userId, pinned: nextPinned })
				}
				emitPinChange(userId, nextPinned)

				if (jsonStorage.cache?.serverPins) {
					const currentPins: string[] =
						jsonStorage.cache.serverPins[targetScope] || []
					const updatedPins: string[] = nextPinned
						? Array.from(new Set([...currentPins, userId]))
						: currentPins.filter((id: string) => id !== userId)
					jsonStorage.cache = {
						...jsonStorage.cache,
						serverPins: {
							...jsonStorage.cache.serverPins,
							[targetScope]: updatedPins,
						},
					}
				}

				const shouldVibrate =
					settings.enableVibration !== undefined
						? settings.enableVibration
						: (settings.enableHaptics ?? true)
				if (shouldVibrate) {
					try {
						Vibration.vibrate(50)
					} catch {}
				}

				void togglePinUser(
					jsonStorage,
					targetScope,
					userId,
					{
						username: user?.username,
						globalName: user?.globalName,
						avatar: user?.avatar,
					},
					scopeId,
				)
					.then(persistedPinned => {
						const displayName = user?.globalName || user?.username || userId
						const scopeText =
							targetScope === 'global' ? 'globally' : 'to top of mentions'
						showToast({
							content: persistedPinned
								? `Pinned @${displayName} ${scopeText}`
								: `Unpinned @${displayName} from mentions`,
							key: `pin-${userId}-${Date.now()}`,
							variant: persistedPinned ? 'success' : 'default',
						})
					})
					.catch(() => {
						if (typeof setOverride === 'function') {
							setOverride({ id: userId, pinned: basePinned })
						}
						emitPinChange(userId, basePinned)
					})
			}

			const existingProps = rendered.props as Record<string, unknown>
			const newProps: Record<string, unknown> = {
				...existingProps,
				onLongPress: handleLongPress,
				delayLongPress: 350,
			}

			if (isPinned && settings?.showPinBadge) {
				const pinIndicator = createElement(
					View,
					{
						key: 'pinned-mentions-indicator',
						style: {
							justifyContent: 'center',
							alignItems: 'center',
							paddingHorizontal: 4,
						},
					},
					createElement(TableRowAssetIcon, {
						name: 'PinIcon',
					}),
				)

				const existingTrailing = existingProps.trailing as ReactNode
				if (existingTrailing) {
					newProps.trailing = createElement(
						View,
						{
							style: {
								flexDirection: 'row',
								alignItems: 'center',
								gap: 4,
							},
						},
						pinIndicator,
						existingTrailing,
					)
				} else {
					newProps.trailing = pinIndicator
				}
			}

			return cloneElement(rendered, newProps)
		})

		cleanup(() => {
			if (target) patchedRowTargets.delete(target)
			try {
				unpatch()
			} catch {}
		})
	}

	try {
		const [foundMod] = lookupModule(
			withProps<TargetRowModule>('User', 'Role', 'Channel', 'Emoji'),
		)
		if (foundMod) applyPatchToRowModule(foundMod)
	} catch {}

	try {
		const unsub = getModules(
			withProps<TargetRowModule>('User', 'Role', 'Channel', 'Emoji'),
			mod => applyPatchToRowModule(mod),
		)
		cleanup(unsub)
	} catch {}
}
