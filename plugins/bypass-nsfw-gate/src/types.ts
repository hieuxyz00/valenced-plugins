export interface BypassSettings {
	bypassChannelGate: boolean
	bypassGuildGate: boolean
	bypassAgeVerification: boolean
	forceAdultStatus: boolean
}

export const DefaultBypassSettings: Readonly<BypassSettings> = {
	bypassChannelGate: true,
	bypassGuildGate: true,
	bypassAgeVerification: true,
	forceAdultStatus: true,
}

export interface DiscordUser {
	id: string
	nsfwAllowed?: boolean
	ageVerificationStatus?: number
	[key: string]: unknown
}

export interface UserStoreType {
	getCurrentUser: () => DiscordUser | null | undefined
	getUser: (id: string) => DiscordUser | null | undefined
	[key: string]: unknown
}

export interface GatedChannelStoreType {
	isChannelGated: (guildId?: string, channelId?: string) => boolean
	isChannelGatedAndVisible: (guildId?: string, channelId?: string) => boolean
	isChannelOrThreadParentGated: (channelId?: string) => boolean
	[key: string]: unknown
}

export interface GuildNSFWAgreeStoreType {
	didAgree: (guildId?: string) => boolean
	[key: string]: unknown
}

export interface AgeVerificationStoreType {
	getReactiveCheckPassed: () => boolean
	shouldCallReactiveCheck: () => boolean
	getReactiveCheckStatus: () => string
	getReactiveCheckMiss: () => boolean
	[key: string]: unknown
}

export interface RegionalFeatureConfigStoreType {
	hasAgeGatedFeatures: () => boolean
	isFeatureAgeGated: (feature?: unknown) => boolean
	[key: string]: unknown
}

export interface FluxAction {
	type: string
	[key: string]: unknown
}

export interface FluxDispatcherType {
	dispatch: (action: FluxAction) => void
	[key: string]: unknown
}
