import { callNativeMethod } from '@valenced/modules/native'
import { getConstants, writeFile } from '@valenced/modules/native/fs'
import { Platform, Share } from 'react-native'

export async function saveViaSaf(
	fileName: string,
	mimeType: string,
	content: string,
): Promise<boolean> {
	if (Platform.OS === 'android') {
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

	if (Platform.OS === 'ios') {
		try {
			const constants = getConstants()
			if (constants?.cache) {
				const filePath = `${constants.cache}/${fileName}`
				await writeFile(filePath, content)
				if (Share && typeof Share.share === 'function') {
					await Share.share({
						url: `file://${filePath}`,
						title: fileName,
					})
					return true
				}
			}
		} catch {
			return false
		}
	}

	return false
}

export async function pickViaSaf(mimeType = '*/*'): Promise<string | null> {
	if (Platform.OS !== 'android') {
		return null
	}
	try {
		return await callNativeMethod('hieuxyz.lib.pickViaSaf', [mimeType])
	} catch {
		return null
	}
}

export async function readFileBase64(path: string): Promise<string | null> {
	if (Platform.OS !== 'android') {
		return null
	}
	try {
		return await callNativeMethod('hieuxyz.lib.readFileBase64', [path])
	} catch {
		return null
	}
}

export async function writeFileBase64(
	path: string,
	base64: string,
): Promise<boolean> {
	if (Platform.OS !== 'android') {
		return false
	}
	try {
		return await callNativeMethod('hieuxyz.lib.writeFileBase64', [path, base64])
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
		'hieuxyz.lib.pickViaSaf': [[mimeType: string], string | null]
		'hieuxyz.lib.readFileBase64': [[path: string], string | null]
		'hieuxyz.lib.writeFileBase64': [[path: string, base64: string], boolean]
	}
}
