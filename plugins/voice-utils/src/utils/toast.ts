import { ToastActionCreators } from '@valenced/discord/actions'

interface ValencedToastsApi {
	show?: (opts: { title?: string; message: string }) => void
}

declare const valenced: unknown

let toastCounter = 0

export function showToast(content: string, key?: string): void {
	toastCounter += 1
	const toastKey = key ?? `voice-utils-${Date.now()}-${toastCounter}`

	try {
		const valencedObj = valenced as { toasts?: ValencedToastsApi }
		if (typeof valencedObj?.toasts?.show === 'function') {
			valencedObj.toasts.show({
				title: 'Voice Utils',
				message: content,
			})
			return
		}
	} catch {}

	if (!ToastActionCreators || typeof ToastActionCreators.open !== 'function') {
		return
	}

	try {
		const openFn = ToastActionCreators.open as unknown as (
			arg1: unknown,
			arg2?: unknown,
		) => void

		if (ToastActionCreators.open.length === 1) {
			openFn({
				key: toastKey,
				content,
				text: content,
			})
		} else {
			openFn(toastKey, {
				text: content,
				content,
			})
		}
	} catch {
		try {
			const fallbackFn = ToastActionCreators.open as unknown as (
				opts: unknown,
			) => void
			fallbackFn({
				key: toastKey,
				content,
				text: content,
			})
		} catch {}
	}
}
