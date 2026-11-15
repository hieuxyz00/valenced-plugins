import { callNativeMethodSync } from '@valenced/modules/native'
import { Platform } from 'react-native'

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
	if (Platform.OS !== 'android') return
	try {
		callNativeMethodSync('hieuxyz.stafftags.putTags', [JSON.stringify(tags)])
	} catch {}
}

export function clearNativeTags(): void {
	if (Platform.OS !== 'android') return
	try {
		callNativeMethodSync('hieuxyz.stafftags.clearTags', [])
	} catch {}
}

declare module '@valenced/modules/native' {
	interface NativeMethods {
		'hieuxyz.stafftags.putTags': [[json: string], null]
		'hieuxyz.stafftags.clearTags': [[], null]
	}
}
