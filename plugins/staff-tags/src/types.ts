import type { ComponentType } from 'react'

export interface TagCustomConfig {
	name?: string
	color?: string
	icon?: string
}

export type CustomTagsConfig = Record<string, TagCustomConfig>

export interface Settings {
	useRoleColor: boolean
	customTags?: CustomTagsConfig
}

export interface DiscordUser {
	id: string
	username: string
	discriminator?: string
	bot?: boolean
	isNonUserBot?: () => boolean
}

export interface DiscordGuild {
	id: string
	name?: string
	ownerId?: string
}

export interface DiscordPermissionOverwrite {
	id: string
	type: number
	allow: bigint | number
	deny: bigint | number
}

export interface DiscordPermissionOverwrites {
	[id: string]: DiscordPermissionOverwrite
}

export interface DiscordChannel {
	id: string
	guild_id?: string
	guildId?: string
	permissionOverwrites?: DiscordPermissionOverwrites
}

export interface DiscordRoleColorStrings {
	primaryColor?: string | null
	secondaryColor?: string | null
	tertiaryColor?: string | null
}

export interface DiscordGuildMember {
	userId?: string
	guildId?: string
	colorString?: string | null
	colorStrings?: DiscordRoleColorStrings | null
	colorRoleId?: string | null
	roles?: string[]
}

export interface DiscordMessage {
	id?: string
	channel_id?: string
	channelId?: string
	guild_id?: string
	guildId?: string
	author?: DiscordUser
	authorId?: string
	author_id?: string
}

export interface Tag {
	text: string
	textColor?: string
	backgroundColor?: string
	verified?:
		| boolean
		| ((
				guild?: DiscordGuild,
				channel?: DiscordChannel,
				user?: DiscordUser,
		  ) => boolean)
	condition?: (
		guild?: DiscordGuild,
		channel?: DiscordChannel,
		user?: DiscordUser,
	) => boolean
	permissions?: bigint[]
}

export interface TagResult {
	text: string
	textColor: string
	backgroundColor: string
	verified: boolean
	icon?: string
}

export interface TagPropertiesResult {
	tagType?: unknown
	tagText?: string
	tagTextColor?: number
	tagBackgroundColor?: number
	tagVerified?: boolean
	[key: string]: unknown
}

export interface TagComponentProps {
	type?: number
	text?: string
	textColor?: string
	backgroundColor?: string
	verified?: boolean
	icon?: string
	style?: unknown
}

export interface TagModule {
	default: ComponentType<TagComponentProps>
	getBotLabel?: unknown
	Types?: unknown
	[key: string]: unknown
}

export interface ReactElementWithProps<
	P extends Record<string, unknown> = Record<string, unknown>,
> {
	type?: unknown
	props?: P
	key?: string | number | null
}

export function isReactElement(
	value: unknown,
): value is ReactElementWithProps<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && 'props' in value
}

declare module '@valenced/plugins/types' {
	interface PluginApi {
		hieuxyz?: import('../../lib/src').HieuxyzApi
	}
	interface UnscopedPluginApi {
		hieuxyz?: import('../../lib/src').HieuxyzApi
	}
}
