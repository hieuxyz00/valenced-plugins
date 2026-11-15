export type ExportDestination = 'saf' | 'share' | 'clipboard'
export type ExportFormat = 'html' | 'text' | 'json'
export type ExportScope = 'message' | 'before' | 'after' | 'channel'

export interface Settings {
	destination: ExportDestination
	format: ExportFormat
	includeAttachments: boolean
	includeEmbeds: boolean
	includeTimestamps: boolean
}

export const DefaultSettings: Settings = {
	destination: 'saf',
	format: 'html',
	includeAttachments: true,
	includeEmbeds: true,
	includeTimestamps: true,
}

export interface DiscordAuthor {
	id: string
	username: string
	discriminator?: string
	globalName?: string
	avatar?: string
	bot?: boolean
	system?: boolean
}

export interface DiscordAttachment {
	id?: string
	filename: string
	url: string
	proxy_url?: string
	size?: number
	content_type?: string
}

export interface DiscordEmbedField {
	name: string
	value: string
	inline?: boolean
}

export interface DiscordEmbed {
	title?: string
	description?: string
	url?: string
	fields?: DiscordEmbedField[]
	color?: number
	author?: {
		name?: string
		icon_url?: string
		url?: string
	}
	thumbnail?: {
		url?: string
		proxy_url?: string
		width?: number
		height?: number
	}
	image?: {
		url?: string
		proxy_url?: string
		width?: number
		height?: number
	}
	footer?: {
		text?: string
		icon_url?: string
	}
	timestamp?: string | number | Date
}

export interface DiscordReactionEmoji {
	id?: string
	name: string
	animated?: boolean
}

export interface DiscordReaction {
	emoji: DiscordReactionEmoji
	count: number
}

export interface DiscordMessageReference {
	channel_id?: string
	guild_id?: string
	message_id?: string
}

export interface DiscordStickerItem {
	id: string
	name: string
	format_type?: number
}

export interface DiscordMessage {
	id: string
	channel_id?: string
	content?: string
	timestamp?: string | number | Date
	editedTimestamp?: string | number | Date
	author: DiscordAuthor
	attachments?: DiscordAttachment[]
	embeds?: DiscordEmbed[]
	colorString?: string
	nick?: string
	pinned?: boolean
	reactions?: DiscordReaction[]
	messageReference?: DiscordMessageReference
	referencedMessage?: DiscordMessage
	stickerItems?: DiscordStickerItem[]
	[key: string]: unknown
}

export interface ChannelExportMetadata {
	id: string
	name: string
	guildName?: string
	guildIconUrl?: string
	topic?: string
	totalMessages: number
	exportedAt: string
	rangeDescription?: string
}
