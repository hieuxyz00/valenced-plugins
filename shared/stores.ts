import { getStore, Stores, withStoreName } from '@valenced/discord/flux'
import { lookupModule } from '@valenced/modules/finders'
import type { DiscordModules } from '@valenced/discord/types'

export interface UserRecord {
	id: string
	username?: string
	globalName?: string | null
	discriminator?: string
	bot?: boolean
	getAvatarURL?(guildId?: string | null, size?: number): string
}

export interface ChannelRecord {
	id: string
	guild_id?: string | null
	name?: string
	type?: number
	parent_id?: string | null
	isDM?: () => boolean
	isGroupDM?: () => boolean
	isThread?: () => boolean
}

export interface GuildRecord {
	id: string
	name?: string
	ownerId?: string
	icon?: string | null
}

export interface MessageRecord {
	id: string
	channel_id: string
	author?: UserRecord
	content?: string
	timestamp?: unknown
	state?: string
	type?: number
}

export interface PendingReplyRecord {
	channel?: ChannelRecord
	message?: MessageRecord
	shouldMention?: boolean
	showMentionToggle?: boolean
}

export interface StoreListenable {
	addChangeListener?: (listener: () => void) => void
	removeChangeListener?: (listener: () => void) => void
}

export interface UserStoreLike extends StoreListenable {
	getCurrentUser?: () => UserRecord | undefined
	getUser?: (userId: string) => UserRecord | undefined
}

export interface ChannelStoreLike extends StoreListenable {
	getChannel?: (channelId: string) => ChannelRecord | undefined
}

export interface SelectedChannelStoreLike extends StoreListenable {
	getChannelId?: () => string | undefined
	getVoiceChannelId?: () => string | undefined
}

export interface GuildStoreLike extends StoreListenable {
	getGuild?: (guildId: string) => GuildRecord | undefined
	getGuilds?: () => Record<string, GuildRecord>
}

export interface MessageStoreLike extends StoreListenable {
	getMessage?: (channelId: string, messageId: string) => MessageRecord | undefined
}

export interface PendingReplyStoreLike extends StoreListenable {
	getPendingReply?: (channelId: string) => PendingReplyRecord | undefined
}

export interface ExperimentStoreLike extends StoreListenable {
	getAllExperimentOverrideDescriptors?: () => Record<string, unknown>
}

export interface PermissionStoreLike extends StoreListenable {
	can?: (permission: bigint, context: unknown) => boolean
}

export function getFluxStore<T>(
	name: string,
): DiscordModules.Flux.Store<T> | undefined {
	const [store, id] = lookupModule(withStoreName<T>(name))
	if (id === undefined) return undefined
	return store
}

export function getTypedStore<T extends object>(name: string): T | undefined {
	try {
		const storeMap = Stores as unknown as Record<string, unknown>
		const store = storeMap?.[name]
		if (store && typeof store === 'object') {
			return store as T
		}
		return undefined
	} catch {
		return undefined
	}
}

export function subscribeTypedStore<T extends object>(
	name: string,
	callback: (store: T) => void,
): () => void {
	return getStore<T>(name, callback)
}

export function getCurrentUser(): UserRecord | undefined {
	return getTypedStore<UserStoreLike>('UserStore')?.getCurrentUser?.()
}

export function getSelectedChannelId(): string | undefined {
	return getTypedStore<SelectedChannelStoreLike>(
		'SelectedChannelStore',
	)?.getChannelId?.()
}

export function getChannel(channelId: string): ChannelRecord | undefined {
	return getTypedStore<ChannelStoreLike>('ChannelStore')?.getChannel?.(channelId)
}

export function getGuild(guildId: string): GuildRecord | undefined {
	return getTypedStore<GuildStoreLike>('GuildStore')?.getGuild?.(guildId)
}

export function getMessage(
	channelId: string,
	messageId: string,
): MessageRecord | undefined {
	return getTypedStore<MessageStoreLike>('MessageStore')?.getMessage?.(
		channelId,
		messageId,
	)
}
