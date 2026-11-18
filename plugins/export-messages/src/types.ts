export type ExportDestination = 'saf' | 'share' | 'clipboard'
export type ExportFormat = 'html' | 'text' | 'json'
export type ExportScope = 'message' | 'before' | 'after' | 'channel'

export interface Settings {
	destination: ExportDestination
	format: ExportFormat
	includeAttachments: boolean
	includeEmbeds: boolean
	includeTimestamps: boolean
	includeComponents?: boolean
}

export const DefaultSettings: Settings = {
	destination: 'saf',
	format: 'html',
	includeAttachments: true,
	includeEmbeds: true,
	includeTimestamps: true,
	includeComponents: true,
}

export interface DiscordAuthor {
	id: string
	username: string
	discriminator?: string
	globalName?: string
	global_name?: string
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
	original_content_type?: string
	duration_secs?: number
	waveform?: string
	flags?: number
	title?: string
	description?: string
	width?: number
	height?: number
}

export interface DiscordEmbedField {
	name?: string
	value?: string
	rawName?: string
	rawValue?: string
	inline?: boolean
}

export interface DiscordEmbed {
	type?: string
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
	type?: number
}

export interface DiscordCall {
	duration?: number
	ended_timestamp?: string | number | Date
	participants?: string[]
}

export interface DiscordInteraction {
	id?: string
	name?: string
	user?: DiscordAuthor
	author?: DiscordAuthor
}

export interface DiscordInteractionMetadata {
	id?: string
	type?: number
	name?: string
	user?: DiscordAuthor
	author?: DiscordAuthor
}

export interface DiscordStickerItem {
	id: string
	name: string
	format_type?: number
	formatType?: number
}

export type DiscordButtonStyle = 1 | 2 | 3 | 4 | 5 | 6

export interface DiscordComponentEmoji {
	id?: string
	name?: string
	animated?: boolean
}

export interface DiscordSelectOption {
	label: string
	value: string
	description?: string
	emoji?: DiscordComponentEmoji
	default?: boolean
}

export interface DiscordMediaItem {
	media?: {
		url?: string
		proxy_url?: string
		width?: number
		height?: number
		placeholder?: string
	}
	description?: string
	spoiler?: boolean
	[key: string]: unknown
}

export interface DiscordComponent {
	type: number | string
	id?: number | string
	custom_id?: string
	style?: DiscordButtonStyle | number
	label?: string
	disabled?: boolean
	emoji?: DiscordComponentEmoji
	url?: string
	placeholder?: string
	min_values?: number
	max_values?: number
	options?: DiscordSelectOption[]
	content?: string
	accent_color?: number
	spoiler?: boolean
	spacing?: number
	divider?: boolean
	media?: {
		url?: string
		proxy_url?: string
		width?: number
		height?: number
	}
	file?: {
		url?: string
		proxy_url?: string
		filename?: string
		size?: number
	}
	filename?: string
	size?: number
	description?: string
	title?: string
	components?: DiscordComponent[]
	accessory?: DiscordComponent
	items?: DiscordMediaItem[]
	[key: string]: unknown
}

export interface DiscordPollMedia {
	text?: string
	emoji?: DiscordReactionEmoji
}

export interface DiscordPollAnswer {
	answer_id: number | string
	poll_media: DiscordPollMedia
}

export interface DiscordPollResultAnswerCount {
	id: number | string
	count: number
	me_voted?: boolean
}

export interface DiscordPollResults {
	is_finalized?: boolean
	total_votes?: number
	answer_counts?: DiscordPollResultAnswerCount[]
}

export interface DiscordPoll {
	question: DiscordPollMedia
	answers: DiscordPollAnswer[]
	expiry?: string | number | Date
	allow_multiselect?: boolean
	layout_type?: number
	results?: DiscordPollResults
}

export interface DiscordMessageSnapshot {
	message: {
		id?: string
		type?: number
		content?: string
		timestamp?: string | number | Date
		editedTimestamp?: string | number | Date
		edited_timestamp?: string | number | Date
		author?: DiscordAuthor
		attachments?: DiscordAttachment[]
		embeds?: DiscordEmbed[]
		components?: DiscordComponent[]
		flags?: number
		poll?: DiscordPoll
		stickers?: DiscordStickerItem[]
		stickerItems?: DiscordStickerItem[]
		sticker_items?: DiscordStickerItem[]
		[key: string]: unknown
	}
	[key: string]: unknown
}

export interface DiscordMessage {
	id: string
	channel_id?: string
	type?: number
	content?: string
	timestamp?: string | number | Date
	editedTimestamp?: string | number | Date
	edited_timestamp?: string | number | Date
	flags?: number
	author: DiscordAuthor
	attachments?: DiscordAttachment[]
	embeds?: DiscordEmbed[]
	components?: DiscordComponent[]
	colorString?: string
	nick?: string
	pinned?: boolean
	reactions?: DiscordReaction[]
	messageReference?: DiscordMessageReference
	referencedMessage?: DiscordMessage
	stickerItems?: DiscordStickerItem[]
	stickers?: DiscordStickerItem[]
	messageSnapshots?: DiscordMessageSnapshot[]
	message_snapshots?: DiscordMessageSnapshot[]
	poll?: DiscordPoll
	interaction?: DiscordInteraction
	interactionMetadata?: DiscordInteractionMetadata
	call?: DiscordCall
	mentions?: DiscordAuthor[]
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
