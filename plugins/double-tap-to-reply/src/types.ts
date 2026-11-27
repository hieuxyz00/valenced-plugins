export type OwnMessageAction = 'reply' | 'edit'

export interface DoubleTapSettings {
	enabled: boolean
	ownMessageAction: OwnMessageAction
	tapFallback: boolean
	doubleTapDelayMs: number
}

export const DEFAULT_SETTINGS: DoubleTapSettings = {
	enabled: true,
	ownMessageAction: 'reply',
	tapFallback: false,
	doubleTapDelayMs: 320,
}
