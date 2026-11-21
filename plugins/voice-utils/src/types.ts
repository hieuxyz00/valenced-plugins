export interface Settings {
	enableVoiceStatus: boolean
	enableBulkActions: boolean
	confirmDisconnect: boolean
	confirmMove: boolean
}

export const DefaultSettings: Settings = {
	enableVoiceStatus: true,
	enableBulkActions: true,
	confirmDisconnect: true,
	confirmMove: true,
}

export interface ChannelRecord {
	id: string
	name?: string
	guild_id?: string | null
	guildId?: string | null
	type?: number
	isGuildVoice?: () => boolean
	isGuildStageVoice?: () => boolean
}

export interface VoiceStateRecord {
	userId: string
	channelId?: string | null
	sessionId?: string
	mute?: boolean
	deaf?: boolean
	selfMute?: boolean
	selfDeaf?: boolean
	suppress?: boolean
}

export interface ActionSheetRowProps {
	key?: string
	label?: string
	message?: string
	subLabel?: string
	variant?: 'default' | 'danger' | string
	onPress?: () => void
	onPressRow?: () => void
	icon?: unknown
	trailing?: unknown
	leading?: unknown
}

export interface ActionSheetProps {
	channel?: ChannelRecord
	channelId?: string
	onClose?: () => void
	[key: string]: unknown
}

export interface VoiceStatusModalProps {
	channel: ChannelRecord
	initialStatus?: string
	draftText?: string
	startExpanded?: boolean
}

export interface DiscordEmoji {
	id?: string
	name?: string
	surrogate?: string
	surrogates?: string
	animated?: boolean
}

export interface HttpModuleExports {
	HTTP: {
		get(options: { url: string }): Promise<{ body?: unknown }>
		put(options: { url: string; body?: unknown }): Promise<{ body?: unknown }>
		patch(options: { url: string; body?: unknown }): Promise<{ body?: unknown }>
	}
}

export interface ChannelActionsExports {
	updateVoiceChannelStatus?: (
		channelId: string,
		status: string,
	) => Promise<unknown>
}

export interface GuildActionsExports {
	setChannel?: (
		guildId: string,
		userId: string,
		channelId: string | null,
	) => Promise<unknown> | void
	setServerMute?: (
		guildId: string,
		userId: string,
		mute: boolean,
	) => Promise<unknown> | void
	setServerDeaf?: (
		guildId: string,
		userId: string,
		deaf: boolean,
	) => Promise<unknown> | void
}

export interface PermissionStoreExports {
	can(permission: bigint, context: unknown): boolean
}

export interface VoiceStateStoreExports {
	getVoiceStatesForChannel(
		channelId: string,
	): Record<string, VoiceStateRecord> | undefined
	getVoiceStates(guildId: string): Record<string, VoiceStateRecord> | undefined
}

export interface ChannelStoreExports {
	getChannel(channelId: string): ChannelRecord | undefined
	getMutableGuildChannelsForGuild(
		guildId: string,
	): Record<string, ChannelRecord> | undefined
}

export interface ChannelStatusStoreExports {
	getChannelStatus(
		channel: ChannelRecord | string,
	): { status?: string } | string | undefined
}
