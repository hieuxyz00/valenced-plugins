import { callNativeMethodSync } from '@valenced/modules/native'

export interface NativeTagPayload {
	text: string
	icon?: string
	assetUri?: string
	textColor?: number
	backgroundColor?: number
	gradient?: number[]
	gradientOrientation?: string
}

export function putNativeTags(tags: Record<string, NativeTagPayload>): void {
	try {
		callNativeMethodSync('hieuxyz.stafftags.putTags', [JSON.stringify(tags)])
	} catch {
		// Graceful no-op in environments without native hook
	}
}

export function clearNativeTags(): void {
	try {
		callNativeMethodSync('hieuxyz.stafftags.clearTags', [])
	} catch {
		// Graceful no-op
	}
}

declare module '@valenced/modules/native' {
	interface NativeMethods {
		'hieuxyz.stafftags.putTags': [[json: string], null]
		'hieuxyz.stafftags.clearTags': [[], null]
	}
}
