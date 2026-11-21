import { ToastActionCreators } from '@valenced/discord/actions'

let toastCounter = 0

export function showToast(content: string, key?: string): void {
	toastCounter += 1
	ToastActionCreators.open({
		key: key ?? `voice-utils-${Date.now()}-${toastCounter}`,
		content,
	})
}
