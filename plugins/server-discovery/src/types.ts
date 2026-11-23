export interface DiscoverableGuild {
	id: string
	name: string
	description?: string | null
	icon?: string | null
	splash?: string | null
	discovery_splash?: string | null
	banner?: string | null
	approximate_member_count?: number
	approximate_presence_count?: number
	features?: string[]
	vanity_url_code?: string | null
	primary_category_id?: number
}

export interface GuildPreview {
	id: string
	name: string
	icon?: string | null
	splash?: string | null
	discovery_splash?: string | null
	banner?: string | null
	description?: string | null
	features?: string[]
	approximate_member_count?: number
	approximate_presence_count?: number
	emojis?: Array<{
		id: string
		name: string
		animated?: boolean
		available?: boolean
	}>
	stickers?: Array<{
		id: string
		name: string
		format_type?: number
	}>
}

export interface DiscoveryCategory {
	id: number
	name: string
	is_primary?: boolean
}

export interface DiscoverableGuildsResponse {
	guilds: DiscoverableGuild[]
	total?: number
	total_count?: number
	offset?: number
	limit?: number
}

export interface Settings {
	resultsPerPage?: number
	defaultCategory?: number
	enableServerListItem: boolean
	enableSettingsItem?: boolean
	enableSettingsEntry?: boolean
	themeOverrides?: Record<string, string>
}

export const DefaultSettings: Settings = {
	resultsPerPage: 24,
	defaultCategory: 0,
	enableServerListItem: true,
	enableSettingsItem: true,
	enableSettingsEntry: true,
	themeOverrides: {},
}
