import { Stores } from '@valenced/discord/flux'
import { getModules, lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { getActiveScopeId, getEffectivePinnedUserIds } from '../utils/storage'
import type { JsonStorage } from '@valenced/json-storage'
import type {
	MentionQueryItem,
	MentionQueryItemUser,
	MentionQueryOptions,
	MentionQueryResult,
	Settings,
} from '../types'

interface MentionQueryTarget {
	queryMentionResults: (options: MentionQueryOptions) => MentionQueryResult
}

interface MentionQueryModule {
	queryMentionResults?: (options: MentionQueryOptions) => MentionQueryResult
	default?: {
		queryMentionResults?: (options: MentionQueryOptions) => MentionQueryResult
	}
}

interface UserStoreType {
	getUser?: (id: string) => MentionQueryItemUser | undefined
}

interface GuildMemberStoreType {
	getMember?: (
		guildId: string,
		userId: string,
	) => { nick?: string | null } | undefined
}

interface PresenceStoreType {
	getStatus?: (userId: string) => string | undefined
}

const patchedTargets = new WeakSet<object>()

export function patchMentionQuery(
	cleanup: (fn: () => void) => void,
	jsonStorage: JsonStorage<Settings>,
): void {
	const applyPatchToModule = (mod: MentionQueryModule | undefined) => {
		if (!mod) return

		let target: MentionQueryTarget | undefined

		if (typeof mod.queryMentionResults === 'function') {
			target = mod as unknown as MentionQueryTarget
		} else if (typeof mod.default?.queryMentionResults === 'function') {
			target = mod.default as unknown as MentionQueryTarget
		}

		if (!target || patchedTargets.has(target)) return
		patchedTargets.add(target)

		const unpatch = instead(
			target,
			'queryMentionResults',
			function (args, orig) {
				const settings = jsonStorage.cache as
					| (Settings & {
							longPressPinsGlobally?: boolean
							enableHaptics?: boolean
					  })
					| undefined

				if (!settings?.enabled) {
					return Reflect.apply(orig, this, args) as MentionQueryResult
				}

				const options = args[0] ?? {}
				const channel = options.channel
				const isGuild = Boolean(channel?.guild_id && channel.guild_id !== '@me')
				const isDm = !isGuild
				if (settings.disableInDms && isDm) {
					return Reflect.apply(orig, this, args) as MentionQueryResult
				}

				const scopeId = isGuild
					? channel!.guild_id!
					: channel
						? 'global'
						: getActiveScopeId()

				const pinnedIds = getEffectivePinnedUserIds(settings, scopeId)
				if (pinnedIds.length === 0) {
					return Reflect.apply(orig, this, args) as MentionQueryResult
				}

				const result = Reflect.apply(orig, this, args) as MentionQueryResult
				if (!result || typeof result !== 'object') return result
				if (!Array.isArray(result.users)) return result

				let query = (options.query || '').trim().toLowerCase()
				if (query.startsWith('@')) {
					query = query.slice(1).trim()
				}

				const existingUsers = result.users
				const pinnedInResultMap = new Map<string, MentionQueryItem>()
				const unpinnedInResult: MentionQueryItem[] = []

				for (let i = 0; i < existingUsers.length; i++) {
					const item = existingUsers[i]
					const userId = item?.user?.id
					if (userId && pinnedIds.includes(userId)) {
						pinnedInResultMap.set(userId, item)
					} else {
						unpinnedInResult.push(item)
					}
				}

				if (
					!settings.alwaysOnTop &&
					pinnedInResultMap.size === pinnedIds.length
				) {
					const allPinned: MentionQueryItem[] = []
					for (let i = 0; i < pinnedIds.length; i++) {
						const item = pinnedInResultMap.get(pinnedIds[i])
						if (item) allPinned.push(item)
					}
					return {
						...result,
						users: [...allPinned, ...unpinnedInResult],
					}
				}

				const allPinned: MentionQueryItem[] = []
				const userStore = Stores?.UserStore as UserStoreType | undefined
				const memberStore = Stores?.GuildMemberStore as
					| GuildMemberStoreType
					| undefined
				const presenceStore = Stores?.PresenceStore as
					| PresenceStoreType
					| undefined

				const getUser = userStore?.getUser?.bind(userStore)
				const getMember =
					isGuild && memberStore?.getMember
						? memberStore.getMember.bind(memberStore, channel!.guild_id!)
						: undefined
				const getStatus = presenceStore?.getStatus?.bind(presenceStore)
				const userCache = settings.userCache

				for (let i = 0; i < pinnedIds.length; i++) {
					const pinnedId = pinnedIds[i]
					const existingItem = pinnedInResultMap.get(pinnedId)
					if (existingItem) {
						allPinned.push(existingItem)
						continue
					}

					const liveUser = getUser?.(pinnedId)
					const cached = userCache?.[pinnedId]

					if (!liveUser && !cached) continue

					const synthesizedUser: MentionQueryItemUser = liveUser || {
						id: pinnedId,
						username: cached?.username || pinnedId,
						globalName: cached?.globalName,
						avatar: cached?.avatar,
					}

					const member = getMember?.(pinnedId)
					const nick = member?.nick ?? null
					const comparator =
						nick || synthesizedUser.globalName || synthesizedUser.username || ''

					if (query.length > 0 && !settings.alwaysOnTop) {
						const nickLower = (nick || '').toLowerCase()
						const globalLower = (synthesizedUser.globalName || '').toLowerCase()
						const usernameLower = (synthesizedUser.username || '').toLowerCase()
						if (
							!nickLower.includes(query) &&
							!globalLower.includes(query) &&
							!usernameLower.includes(query)
						) {
							continue
						}
					}

					const status = getStatus?.(pinnedId) || 'offline'

					allPinned.push({
						user: synthesizedUser,
						score: 0,
						comparator,
						nick,
						status,
					})
				}

				return {
					...result,
					users: [...allPinned, ...unpinnedInResult],
				}
			},
		)

		cleanup(() => {
			if (target) patchedTargets.delete(target)
			try {
				unpatch()
			} catch {}
		})
	}

	try {
		const [foundMod] = lookupModule(
			withProps<MentionQueryTarget>('queryMentionResults'),
		)
		if (foundMod) applyPatchToModule(foundMod)
	} catch {}

	try {
		const unsub = getModules(
			withProps<MentionQueryTarget>('queryMentionResults'),
			mod => applyPatchToModule(mod),
		)
		cleanup(unsub)
	} catch {}
}
