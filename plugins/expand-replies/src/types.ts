export interface Settings {
	maxLines: number
	maxChars: number
	preserveNewlines: boolean
	alignWithLine1: boolean
	trimContentIndents: boolean
	collapseEmptyLines: boolean
}

export const DefaultSettings: Settings = {
	maxLines: 0,
	maxChars: 0,
	preserveNewlines: true,
	alignWithLine1: false,
	trimContentIndents: true,
	collapseEmptyLines: true,
}

export interface ContentNode {
	type?: string
	content?: unknown
	target?: unknown
	items?: ContentNode[][]
	ordered?: boolean
	start?: number
	[key: string]: unknown
}

export interface RowMessage {
	id?: string
	channelId?: string
	content?: ContentNode[]
	referencedMessage?: {
		state?: number
		message?: RowMessage
	}
	[key: string]: unknown
}

export interface MessageRow {
	type?: number
	changeType?: number
	message?: RowMessage
	[key: string]: unknown
}

export interface RowManager {
	prototype: {
		generate(row: unknown): MessageRow
	}
}

export interface MarkupParserModule {
	parseMessageMarkup: (
		message: unknown,
		context: unknown,
		renderReactions: boolean,
		isInlineReplyPreview: boolean,
		isSearchHit: boolean,
		allowHeading: boolean,
		allowList: boolean,
	) => {
		content: ContentNode[]
		isInlineReplyPreview: boolean
		[key: string]: unknown
	}
}
