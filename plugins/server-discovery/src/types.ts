export interface DiscoverableGuild {
	id: string
	name: string
	description: string | null
	splash: string | null
	banner: string | null
	icon: string | null
	features: string[]
	approximate_presence_count: number
	approximate_member_count: number
	premium_subscription_count?: number
	discovery_splash: string | null
	preferred_locale?: string
	vanity_url_code?: string | null
}

export interface GuildPreviewEmoji {
	id: string
	name: string
	animated?: boolean
}

export interface GuildPreviewSticker {
	id: string
	name: string
}

export interface GuildPreview {
	id: string
	name: string
	icon: string | null
	description: string | null
	splash: string | null
	banner?: string | null
	discovery_splash: string | null
	home_header: string | null
	features: string[]
	approximate_member_count: number
	approximate_presence_count: number
	emojis?: GuildPreviewEmoji[]
	stickers?: GuildPreviewSticker[]
}

export interface DiscoveryCategory {
	id: number
	name: string
	is_primary?: boolean
}

export interface DiscoverableGuildsResponse {
	total?: number
	total_count?: number
	guilds: DiscoverableGuild[]
	offset?: number
	limit?: number
}

export interface Settings {
	resultsPerPage: number
	defaultCategory: number
	enableServerListItem: boolean
	enableSettingsItem: boolean
}

export const DefaultSettings: Settings = {
	resultsPerPage: 24,
	defaultCategory: 0,
	enableServerListItem: true,
	enableSettingsItem: true,
}
