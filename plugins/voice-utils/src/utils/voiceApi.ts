import { Stores } from '@valenced/discord/flux'
import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { isVoiceChannel } from './permissions'
import type {
	ChannelActionsExports,
	ChannelRecord,
	ChannelStatusStoreExports,
	ChannelStoreExports,
	GuildActionsExports,
	HttpModuleExports,
	VoiceStateRecord,
	VoiceStateStoreExports,
} from '../types'

function getHttpModule(): HttpModuleExports | undefined {
	const [exports] = lookupModule(withProps('HTTP', 'post'))
	if (!exports) return undefined
	const typed = exports as unknown as HttpModuleExports
	if (typed.HTTP && typeof typed.HTTP.put === 'function') {
		return typed
	}
	return undefined
}

function getChannelActions(): ChannelActionsExports | undefined {
	const [exports, id] = lookupModule(withProps('updateVoiceChannelStatus'))
	if (id !== undefined && exports) {
		const typed = exports as unknown as ChannelActionsExports
		if (typeof typed.updateVoiceChannelStatus === 'function') {
			return typed
		}
	}
	return undefined
}

function getGuildActions(): GuildActionsExports | undefined {
	const [exports] = lookupModule(
		withProps('setServerMute', 'setServerDeaf', 'setChannel'),
	)
	return exports as unknown as GuildActionsExports | undefined
}

export function getVoiceChannelMembers(channelId: string): VoiceStateRecord[] {
	try {
		const store = Stores.VoiceStateStore as unknown as
			| VoiceStateStoreExports
			| undefined
		if (!store || typeof store.getVoiceStatesForChannel !== 'function') {
			return []
		}
		const states = store.getVoiceStatesForChannel(channelId)
		if (!states || typeof states !== 'object') return []
		return Object.values(states)
	} catch {
		return []
	}
}

export function getChannelStatus(channel: ChannelRecord | string): string {
	try {
		const store = Stores.ChannelStatusStore as unknown as
			| ChannelStatusStoreExports
			| undefined
		if (!store || typeof store.getChannelStatus !== 'function') {
			return ''
		}
		const chStore = Stores.ChannelStore as unknown as
			| ChannelStoreExports
			| undefined
		const chRecord =
			typeof channel === 'string'
				? (chStore?.getChannel?.(channel) ?? {
						id: channel,
						type: 2,
						guild_id: '',
					})
				: channel
		if (!chRecord) return ''
		const result = store.getChannelStatus(chRecord)
		if (typeof result === 'string') return result
		if (
			result &&
			typeof result === 'object' &&
			typeof result.status === 'string'
		) {
			return result.status
		}
		return ''
	} catch {
		return ''
	}
}

export function dispatchVoiceChannelStatusUpdate(
	channelId: string,
	status: string,
	guildId?: string,
): void {
	try {
		const chStore = Stores.ChannelStore as unknown as
			| ChannelStoreExports
			| undefined
		const ch = chStore?.getChannel?.(channelId)
		const targetGuildId = guildId || ch?.guild_id || ch?.guildId || ''

		const statusStore = Stores.ChannelStatusStore as unknown as
			| {
					_dispatcher?: { dispatch: (action: Record<string, unknown>) => void }
					emitChange?: () => void
			  }
			| undefined

		if (statusStore?._dispatcher?.dispatch) {
			statusStore._dispatcher.dispatch({
				type: 'VOICE_CHANNEL_STATUS_UPDATE',
				id: channelId,
				channelId,
				channel_id: channelId,
				guildId: targetGuildId,
				guild_id: targetGuildId,
				status: status || null,
			})
		}

		statusStore?.emitChange?.()

		const stores = Stores as unknown as Record<
			string,
			| {
					emitChange?: () => void
					getGuild?: (
						id: string,
					) => { guildChannelsVersion?: number } | undefined
			  }
			| undefined
		>

		if (targetGuildId && stores.ChannelListStore?.getGuild) {
			try {
				const g = stores.ChannelListStore.getGuild(targetGuildId)
				if (g && typeof g.guildChannelsVersion === 'number') {
					g.guildChannelsVersion += 1
				}
			} catch {}
		}

		stores.ChannelListStore?.emitChange?.()
		stores.ChannelStore?.emitChange?.()
		stores.GuildChannelStore?.emitChange?.()
	} catch {}
}

export async function setVoiceChannelStatus(
	channelId: string,
	status: string,
	guildId?: string,
): Promise<boolean> {
	const chStore = Stores.ChannelStore as unknown as
		| ChannelStoreExports
		| undefined
	const ch = chStore?.getChannel?.(channelId)
	const targetGuildId = guildId ?? ch?.guild_id ?? ch?.guildId ?? ''
	const previousStatus = ch ? getChannelStatus(ch) : getChannelStatus(channelId)

	dispatchVoiceChannelStatusUpdate(channelId, status, targetGuildId)

	const channelActions = getChannelActions()
	if (
		channelActions &&
		typeof channelActions.updateVoiceChannelStatus === 'function'
	) {
		try {
			const res = channelActions.updateVoiceChannelStatus(channelId, status)
			if (res && typeof (res as Promise<unknown>).then === 'function') {
				await res
			}
			dispatchVoiceChannelStatusUpdate(channelId, status, targetGuildId)
			return true
		} catch {}
	}

	const http = getHttpModule()
	if (http) {
		try {
			await http.HTTP.put({
				url: `/channels/${channelId}/voice-status`,
				body: { status },
			})
			dispatchVoiceChannelStatusUpdate(channelId, status, targetGuildId)
			return true
		} catch {}
	}

	dispatchVoiceChannelStatusUpdate(channelId, previousStatus, targetGuildId)
	return false
}

const BATCH_SIZE = 4
const BATCH_DELAY_MS = 250

async function runWithRetry<T>(fn: () => Promise<T>): Promise<T | null> {
	try {
		return await fn()
	} catch (err: unknown) {
		const retryAfter = (err as { body?: { retry_after?: number } })?.body
			?.retry_after
		if (typeof retryAfter === 'number' && retryAfter > 0) {
			const waitMs = Math.min(Math.round(retryAfter * 1000), 2000)
			await new Promise(resolve => setTimeout(resolve, waitMs))
			try {
				return await fn()
			} catch {}
		}
		return null
	}
}

async function runBatched<T, R>(
	items: T[],
	batchSize: number,
	delayMs: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = []
	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize)
		const batchResults = await Promise.all(batch.map(fn))
		results.push(...batchResults)
		if (i + batchSize < items.length && delayMs > 0) {
			await new Promise(resolve => setTimeout(resolve, delayMs))
		}
	}
	return results
}

export async function disconnectMembers(
	guildId: string,
	memberIds: string[],
): Promise<number> {
	if (memberIds.length === 0) return 0
	const guildActions = getGuildActions()
	const http = getHttpModule()

	const results = await runBatched(
		memberIds,
		BATCH_SIZE,
		BATCH_DELAY_MS,
		async userId => {
			if (guildActions && typeof guildActions.setChannel === 'function') {
				try {
					await Promise.resolve(guildActions.setChannel(guildId, userId, null))
					return true
				} catch {}
			}
			if (http) {
				const res = await runWithRetry(() =>
					http.HTTP.patch({
						url: `/guilds/${guildId}/members/${userId}`,
						body: { channel_id: null },
					}),
				)
				if (res !== null) return true
			}
			return false
		},
	)

	return results.filter(Boolean).length
}

export async function moveMembers(
	guildId: string,
	targetChannelId: string,
	memberIds: string[],
): Promise<number> {
	if (memberIds.length === 0) return 0
	const guildActions = getGuildActions()
	const http = getHttpModule()

	const results = await runBatched(
		memberIds,
		BATCH_SIZE,
		BATCH_DELAY_MS,
		async userId => {
			if (guildActions && typeof guildActions.setChannel === 'function') {
				try {
					await Promise.resolve(
						guildActions.setChannel(guildId, userId, targetChannelId),
					)
					return true
				} catch {}
			}
			if (http) {
				const res = await runWithRetry(() =>
					http.HTTP.patch({
						url: `/guilds/${guildId}/members/${userId}`,
						body: { channel_id: targetChannelId },
					}),
				)
				if (res !== null) return true
			}
			return false
		},
	)

	return results.filter(Boolean).length
}

export async function muteMembers(
	guildId: string,
	memberIds: string[],
	mute: boolean,
): Promise<number> {
	if (memberIds.length === 0) return 0
	const guildActions = getGuildActions()
	const http = getHttpModule()

	const results = await runBatched(
		memberIds,
		BATCH_SIZE,
		BATCH_DELAY_MS,
		async userId => {
			if (guildActions && typeof guildActions.setServerMute === 'function') {
				try {
					await Promise.resolve(
						guildActions.setServerMute(guildId, userId, mute),
					)
					return true
				} catch {}
			}
			if (http) {
				const res = await runWithRetry(() =>
					http.HTTP.patch({
						url: `/guilds/${guildId}/members/${userId}`,
						body: { mute },
					}),
				)
				if (res !== null) return true
			}
			return false
		},
	)

	return results.filter(Boolean).length
}

export async function deafenMembers(
	guildId: string,
	memberIds: string[],
	deaf: boolean,
): Promise<number> {
	if (memberIds.length === 0) return 0
	const guildActions = getGuildActions()
	const http = getHttpModule()

	const results = await runBatched(
		memberIds,
		BATCH_SIZE,
		BATCH_DELAY_MS,
		async userId => {
			if (guildActions && typeof guildActions.setServerDeaf === 'function') {
				try {
					await Promise.resolve(
						guildActions.setServerDeaf(guildId, userId, deaf),
					)
					return true
				} catch {}
			}
			if (http) {
				const res = await runWithRetry(() =>
					http.HTTP.patch({
						url: `/guilds/${guildId}/members/${userId}`,
						body: { deaf },
					}),
				)
				if (res !== null) return true
			}
			return false
		},
	)

	return results.filter(Boolean).length
}

export function getGuildVoiceChannels(
	guildId: string,
	excludeChannelId?: string,
): ChannelRecord[] {
	try {
		const store = Stores.ChannelStore as unknown as
			| ChannelStoreExports
			| undefined
		if (!store || typeof store.getMutableGuildChannelsForGuild !== 'function') {
			return []
		}
		const map = store.getMutableGuildChannelsForGuild(guildId)
		if (!map || typeof map !== 'object') return []
		const list = Object.values(map)
		return list.filter(
			ch =>
				isVoiceChannel(ch) && (!excludeChannelId || ch.id !== excludeChannelId),
		)
	} catch {
		return []
	}
}
