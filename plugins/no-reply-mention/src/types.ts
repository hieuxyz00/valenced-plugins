export interface Settings {
	enabled: boolean
}

export const DefaultSettings: Settings = {
	enabled: true,
}

export interface PendingReplyEvent {
	channel?: { id?: string; [key: string]: unknown }
	message?: { id?: string; [key: string]: unknown }
	shouldMention?: boolean
	showMentionToggle?: boolean
	[key: string]: unknown
}
