import { ToastActionCreators } from '@valenced/discord/actions'

interface ValencedToastsApi {
	show?: (
		opts:
			| string
			| {
					content: string
					subtitle?: string
					variant?: 'default' | 'success' | 'critical' | 'warning' | 'info'
			  },
	) => void
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
				content,
				subtitle: 'Voice Utils',
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
