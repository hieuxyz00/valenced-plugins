import { Stores } from '@valenced/discord/flux'
import { DefaultSettings } from '../types'
import type { JsonStorage } from '@valenced/json-storage'
import type { PinnedUserRecord, Settings } from '../types'

interface SelectedGuildStoreType {
	getGuildId?: () => string | undefined
}

interface SelectedChannelStoreType {
	getChannelId?: () => string | undefined
}

interface ChannelStoreType {
	getChannel?: (
		id?: string,
	) => { id?: string; guild_id?: string; name?: string } | undefined
}

interface GuildStoreType {
	getGuild?: (
		id?: string,
	) => { id?: string; name?: string; icon?: string } | undefined
}

type PinChangeListener = (userId: string, isPinned: boolean) => void
const pinChangeListeners = new Set<PinChangeListener>()

export function subscribePinChange(listener: PinChangeListener): () => void {
	pinChangeListeners.add(listener)
	return () => {
		pinChangeListeners.delete(listener)
	}
}

export function emitPinChange(userId: string, isPinned: boolean): void {
	for (const listener of pinChangeListeners) {
		try {
			listener(userId, isPinned)
		} catch {}
	}
}

export function getActiveScopeId(): string {
	try {
		const selGuild = Stores?.SelectedGuildStore as
			| SelectedGuildStoreType
			| undefined
		const guildId = selGuild?.getGuildId?.()
		if (guildId && guildId !== '@me') return guildId

		const selChannel = Stores?.SelectedChannelStore as
			| SelectedChannelStoreType
			| undefined
		const channelId = selChannel?.getChannelId?.()
		if (channelId) {
			const chanStore = Stores?.ChannelStore as ChannelStoreType | undefined
			const chan = chanStore?.getChannel?.(channelId)
			if (chan?.guild_id && chan.guild_id !== '@me') return chan.guild_id
		}
	} catch {}
	return 'global'
}

export function getActiveGuild():
	| { id: string; name?: string; icon?: string }
	| undefined {
	try {
		const selGuild = Stores?.SelectedGuildStore as
			| SelectedGuildStoreType
			| undefined
		const guildId = selGuild?.getGuildId?.()
		if (guildId && guildId !== '@me') {
			const guildStore = Stores?.GuildStore as GuildStoreType | undefined
			const guild = guildStore?.getGuild?.(guildId)
			if (guild?.id) return { id: guild.id, name: guild.name, icon: guild.icon }
			return { id: guildId }
		}

		const selChannel = Stores?.SelectedChannelStore as
			| SelectedChannelStoreType
			| undefined
		const channelId = selChannel?.getChannelId?.()
		if (channelId) {
			const chanStore = Stores?.ChannelStore as ChannelStoreType | undefined
			const chan = chanStore?.getChannel?.(channelId)
			if (chan?.guild_id && chan.guild_id !== '@me') {
				const guildStore = Stores?.GuildStore as GuildStoreType | undefined
				const guild = guildStore?.getGuild?.(chan.guild_id)
				if (guild?.id)
					return { id: guild.id, name: guild.name, icon: guild.icon }
				return { id: chan.guild_id }
			}
		}
	} catch {}
	return undefined
}

export function getUserAvatarUrl(
	user:
		| {
				id: string
				avatar?: string
				getAvatarURL?: (guildId?: string, size?: number) => string | undefined
		  }
		| undefined,
	cachedAvatar?: string,
	scopeId?: string,
	size = 64,
): string | undefined {
	if (user?.getAvatarURL) {
		const live = user.getAvatarURL(
			scopeId !== 'global' ? scopeId : undefined,
			size,
		)
		if (live) return live
	}
	const avatarHash = user?.avatar || cachedAvatar
	if (user?.id && avatarHash) {
		return `https://cdn.discordapp.com/avatars/${user.id}/${avatarHash}.png?size=${size}`
	}
	return undefined
}

export function getPinnedUserIds(
	settings: Settings | undefined,
	scopeId: string,
): string[] {
	if (!settings?.serverPins) return []
	const direct = settings.serverPins[scopeId]
	if (Array.isArray(direct)) return direct
	return []
}

export function getEffectivePinnedUserIds(
	settings: Settings | undefined,
	scopeId: string,
): string[] {
	if (!settings?.serverPins) return []
	const direct = settings.serverPins[scopeId]
	const directList = Array.isArray(direct) ? direct : []
	if (scopeId === 'global') return directList
	const globalList = settings.serverPins.global
	if (!Array.isArray(globalList) || globalList.length === 0) return directList

	const seen = new Set(directList)
	const result = [...directList]
	for (const id of globalList) {
		if (!seen.has(id)) {
			seen.add(id)
			result.push(id)
		}
	}
	return result
}

export function isUserPinned(
	settings: Settings | undefined,
	scopeId: string,
	userId: string,
): boolean {
	if (!settings?.serverPins) return false
	const direct = settings.serverPins[scopeId]
	if (Array.isArray(direct) && direct.includes(userId)) return true
	if (scopeId !== 'global') {
		const globalList = settings.serverPins.global
		if (Array.isArray(globalList) && globalList.includes(userId)) return true
	}
	return false
}

export function isUserPinnedDirectly(
	settings: Settings | undefined,
	scopeId: string,
	userId: string,
): boolean {
	if (!settings?.serverPins) return false
	const direct = settings.serverPins[scopeId]
	return Array.isArray(direct) && direct.includes(userId)
}

export async function addPinnedUsers(
	storage: JsonStorage<Settings>,
	scopeId: string,
	users: Array<{ id: string; info?: Partial<PinnedUserRecord> }>,
): Promise<number> {
	if (!users.length) return 0
	const current = await storage.get()
	const serverPins: Record<string, string[]> = {
		...(current?.serverPins || {}),
	}
	const existing = Array.isArray(serverPins[scopeId])
		? [...serverPins[scopeId]]
		: []
	const userCache: Record<string, PinnedUserRecord> = {
		...(current?.userCache || {}),
	}

	let addedCount = 0
	for (const item of users) {
		const userId = item.id
		if (!existing.includes(userId)) {
			existing.push(userId)
			addedCount++
		}
		userCache[userId] = {
			id: userId,
			username: item.info?.username ?? userCache[userId]?.username,
			globalName: item.info?.globalName ?? userCache[userId]?.globalName,
			avatar: item.info?.avatar ?? userCache[userId]?.avatar,
			pinnedAt: Date.now(),
		}
	}

	serverPins[scopeId] = existing
	const nextSettings: Settings = {
		...DefaultSettings,
		...(current || {}),
		serverPins,
		userCache,
	}
	storage.cache = nextSettings
	for (const item of users) {
		emitPinChange(item.id, true)
	}
	await storage.set(nextSettings, true)
	return addedCount
}

export async function addPinnedUser(
	storage: JsonStorage<Settings>,
	scopeId: string,
	userId: string,
	info?: Partial<PinnedUserRecord>,
): Promise<void> {
	await addPinnedUsers(storage, scopeId, [{ id: userId, info }])
}

export async function removePinnedUser(
	storage: JsonStorage<Settings>,
	scopeId: string,
	userId: string,
): Promise<void> {
	const current = await storage.get()
	const serverPins: Record<string, string[]> = {
		...(current?.serverPins || {}),
	}
	const existing = Array.isArray(serverPins[scopeId])
		? [...serverPins[scopeId]]
		: []

	const filtered = existing.filter(id => id !== userId)
	if (filtered.length > 0) {
		serverPins[scopeId] = filtered
	} else {
		delete serverPins[scopeId]
	}

	const nextSettings: Settings = {
		...DefaultSettings,
		...(current || {}),
		serverPins,
		userCache: current?.userCache || {},
	}
	storage.cache = nextSettings
	emitPinChange(userId, false)
	await storage.set(nextSettings, true)
}

export async function togglePinUser(
	storage: JsonStorage<Settings>,
	scopeId: string,
	userId: string,
	info?: Partial<PinnedUserRecord>,
	contextScope?: string,
): Promise<boolean> {
	const current = await storage.get()
	const serverPins: Record<string, string[]> = {
		...(current?.serverPins || {}),
	}

	const targetScope = scopeId
	const checkScope = contextScope || targetScope
	const inCheck =
		Array.isArray(serverPins[checkScope]) &&
		serverPins[checkScope].includes(userId)
	const inTarget =
		Array.isArray(serverPins[targetScope]) &&
		serverPins[targetScope].includes(userId)
	const inGlobal =
		Array.isArray(serverPins.global) && serverPins.global.includes(userId)

	if (inCheck || inTarget || inGlobal) {
		if (inCheck && Array.isArray(serverPins[checkScope])) {
			const filtered = serverPins[checkScope].filter(id => id !== userId)
			if (filtered.length > 0) {
				serverPins[checkScope] = filtered
			} else {
				delete serverPins[checkScope]
			}
		}
		if (
			inTarget &&
			targetScope !== checkScope &&
			Array.isArray(serverPins[targetScope])
		) {
			const filtered = serverPins[targetScope].filter(id => id !== userId)
			if (filtered.length > 0) {
				serverPins[targetScope] = filtered
			} else {
				delete serverPins[targetScope]
			}
		}
		if (
			inGlobal &&
			checkScope !== 'global' &&
			targetScope !== 'global' &&
			Array.isArray(serverPins.global)
		) {
			const filtered = serverPins.global.filter(id => id !== userId)
			if (filtered.length > 0) {
				serverPins.global = filtered
			} else {
				Reflect.deleteProperty(serverPins, 'global')
			}
		}

		const nextSettings: Settings = {
			...DefaultSettings,
			...(current || {}),
			serverPins,
			userCache: current?.userCache || {},
		}
		storage.cache = nextSettings
		emitPinChange(userId, false)
		await storage.set(nextSettings, true)
		return false
	}

	await addPinnedUser(storage, targetScope, userId, info)
	return true
}

export async function clearServerPins(
	storage: JsonStorage<Settings>,
	scopeId: string,
): Promise<void> {
	const current = await storage.get()
	const serverPins: Record<string, string[]> = {
		...(current?.serverPins || {}),
	}
	const clearedUserIds = serverPins[scopeId] || []
	delete serverPins[scopeId]
	const nextSettings: Settings = {
		...DefaultSettings,
		...(current || {}),
		serverPins,
		userCache: current?.userCache || {},
	}
	storage.cache = nextSettings
	for (const id of clearedUserIds) {
		emitPinChange(id, false)
	}
	await storage.set(nextSettings, true)
}
