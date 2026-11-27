import { Clipboard } from '@valenced/externals/react-native-clipboard'

export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		if (Clipboard && typeof Clipboard.setString === 'function') {
			Clipboard.setString(text)
			return true
		}
		return false
	} catch {
		return false
	}
}

export async function readFromClipboard(): Promise<string> {
	try {
		if (Clipboard && typeof Clipboard.getString === 'function') {
			const content = await Clipboard.getString()
			return typeof content === 'string' ? content : ''
		}
		return ''
	} catch {
		return ''
	}
}
