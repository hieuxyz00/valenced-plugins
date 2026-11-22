export interface PinnedUserRecord {
	id: string
	username?: string
	globalName?: string
	avatar?: string
	pinnedAt: number
}

export interface Settings {
	enabled: boolean
	showPinBadge: boolean
	alwaysOnTop: boolean
	longPressTarget: 'server' | 'global'
	enableVibration: boolean
	disableInDms: boolean
	serverPins: Record<string, string[]>
	userCache: Record<string, PinnedUserRecord>
}

export const DefaultSettings: Settings = {
	enabled: true,
	showPinBadge: true,
	alwaysOnTop: false,
	longPressTarget: 'server',
	enableVibration: true,
	disableInDms: false,
	serverPins: {},
	userCache: {},
}

export interface MentionQueryItemUser {
	id: string
	username?: string
	discriminator?: string
	globalName?: string
	avatar?: string
	getAvatarURL?: (guildId?: string, size?: number) => string | undefined
	[key: string]: unknown
}

export interface MentionQueryItem {
	user: MentionQueryItemUser
	score: number
	comparator: string
	nick?: string | null
	status?: string
	[key: string]: unknown
}

export interface MentionQueryResult {
	users: MentionQueryItem[]
	globals?: unknown[]
	roles?: unknown[]
	[key: string]: unknown
}

export interface MentionQueryOptions {
	query?: string
	channel?: {
		id?: string
		guild_id?: string
		[key: string]: unknown
	}
	canMentionEveryone?: boolean
	canMentionRoles?: boolean
	[key: string]: unknown
}

export interface AutocompleteUserProps {
	user?: MentionQueryItemUser
	item?: {
		user?: MentionQueryItemUser
		[key: string]: unknown
	}
	onSelect?: (user: MentionQueryItemUser) => void
	index?: number
	[key: string]: unknown
}

export interface ActionSheetRowComponentProps {
	label?: string
	message?: string
	subLabel?: string
	icon?: {
		type?: unknown
		props?: {
			name?: string
			[key: string]: unknown
		}
	}
	onPress?: () => void
	onPressRow?: () => void
	[key: string]: unknown
}
