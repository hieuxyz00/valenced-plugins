import type { ComponentType, Key, ReactNode } from 'react'

/** Supported translation providers. */
export type TranslationProvider =
	| 'google'
	| 'microsoft'
	| 'mymemory'
	| 'brave'
	| 'lingva'

/** Plugin persistent settings structure. */
export interface Settings {
	provider: TranslationProvider
	sourceLang: string
	targetLang: string
	sendSourceLang: string
	sendTargetLang: string
	autoTranslateSend: boolean
	autoTranslateRev: boolean
	chatButtonEnabled: boolean
	chatButtonPosition: 'left' | 'right'
	revChannels: string[]
	sendChannels: string[]
}

/** Default plugin settings. */
export const DefaultSettings: Readonly<Settings> = {
	provider: 'google',
	sourceLang: 'auto',
	targetLang: 'vi',
	sendSourceLang: 'auto',
	sendTargetLang: 'en',
	autoTranslateSend: false,
	autoTranslateRev: false,
	chatButtonEnabled: true,
	chatButtonPosition: 'right',
	revChannels: [],
	sendChannels: [],
}

/** Check whether a channel is configured for send auto-translation. */
export function isChannelAutoTranslateSend(
	channelId: string | undefined,
	settings: Settings,
): boolean {
	if (!channelId) return false
	return Boolean(
		settings.autoTranslateSend || settings.sendChannels?.includes(channelId),
	)
}

/** Check whether a channel is configured for receive auto-translation. */
export function isChannelAutoTranslateRev(
	channelId: string | undefined,
	settings: Settings,
): boolean {
	if (!channelId) return false
	return Boolean(
		settings.autoTranslateRev || settings.revChannels?.includes(channelId),
	)
}

/** Result of a successful translation request. */
export interface TranslationResult {
	text: string
	detected?: string
	usedProvider?: TranslationProvider
}

/** Unified translation function signature. */
export type TranslateFunction = (
	text: string,
	source: string,
	target: string,
) => Promise<TranslationResult>

/** Representation of a Discord message object. */
export interface DiscordMessage {
	id: string
	channel_id: string
	content?: string
	state?: string
	type?: number
	author?: {
		id?: string
		username?: string
		bot?: boolean
	}
	[key: string]: unknown
}

/** In-memory message collection stored in ChannelMessages cache. */
export interface MessageCollection {
	has(id: string): boolean
	remove(id: string): unknown
	update(id: string, fn: (message: DiscordMessage) => DiscordMessage): unknown
}

/** ChannelMessages cache module. */
export interface ChannelMessagesCache {
	getOrCreate(channelId: string): MessageCollection | undefined
	commit(collection: unknown): void
}

/** MessageStore module. */
export interface MessageStore {
	getMessage(
		channelId: string,
		messageId: string,
	): DiscordMessage | null | undefined
	emitChange?(): void
}

/** State tracking pre-translation content and channel ID for restoration. */
export interface TranslatedMessageState {
	channelId: string
	originalContent: string
	originalEmbeds?: unknown[]
	originalComponents?: unknown[]
}

/** Props passed to MessageLongPressActionSheet. */
export interface MessageLongPressActionSheetProps {
	message?: DiscordMessage
	channel?: {
		id: string
		guild_id?: string | null
		[key: string]: unknown
	}
	[key: string]: unknown
}

/** Module loaded lazily for action sheets. */
export interface LazyActionSheetModule<P = MessageLongPressActionSheetProps> {
	default: ComponentType<P>
}

/** Props accepted by Discord ActionSheet rows. */
export interface ActionSheetRowProps {
	key?: string
	label?: string
	message?: string
	onPress?: () => void
	onPressRow?: () => void
	icon?: ReactNode
	[key: string]: unknown
}

/** A detected ActionSheet row element within the React tree. */
export interface ActionSheetRowElement {
	key?: Key | null
	type: ComponentType<ActionSheetRowProps> | string
	props: ActionSheetRowProps
}

declare module '@valenced/plugins/types' {
	interface PluginApi {
		hieuxyz?: import('../../lib/src').HieuxyzApi
	}
	interface UnscopedPluginApi {
		hieuxyz?: import('../../lib/src').HieuxyzApi
	}
}
