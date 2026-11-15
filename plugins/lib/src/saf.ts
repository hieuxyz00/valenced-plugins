import { callNativeMethod } from '@valenced/modules/native'
import { Platform } from 'react-native'

export async function saveViaSaf(
	fileName: string,
	mimeType: string,
	content: string,
): Promise<boolean> {
	if (Platform.OS !== 'android') {
		return false
	}
	try {
		return await callNativeMethod('hieuxyz.lib.saveViaSaf', [
			fileName,
			mimeType,
			content,
		])
	} catch {
		return false
	}
}

export function isSafAvailable(): boolean {
	return Platform.OS === 'android'
}

declare module '@valenced/modules/native' {
	interface NativeMethods {
		'hieuxyz.lib.saveViaSaf': [
			[fileName: string, mimeType: string, content: string],
			boolean,
		]
	}
}
