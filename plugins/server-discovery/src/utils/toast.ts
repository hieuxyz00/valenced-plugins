import { ToastActionCreators } from '@valenced/discord/actions'

interface RosieToastApi {
	show(options: {
		content: string
		subtitle?: string
		variant?: string
		icon?: unknown
	}): void
}

let toastCounter = 0

function getRosieToasts(): RosieToastApi | undefined {
	try {
		const valencedObj = (globalThis as unknown as Record<string, unknown>)
			.valenced as { toasts?: RosieToastApi } | undefined
		if (typeof valencedObj?.toasts?.show === 'function') {
			return valencedObj.toasts
		}

		const unscoped = (globalThis as unknown as Record<string, unknown>)
			.unscoped as { toasts?: RosieToastApi } | undefined
		if (typeof unscoped?.toasts?.show === 'function') {
			return unscoped.toasts
		}

		const globalToasts = (globalThis as unknown as Record<string, unknown>)
			.toasts as RosieToastApi | undefined
		if (typeof globalToasts?.show === 'function') {
			return globalToasts
		}
	} catch {}
	return undefined
}

export function showToast(content: string, customKey?: string): void {
	toastCounter += 1
	const key = customKey ?? `server-discovery-${Date.now()}-${toastCounter}`

	const rosie = getRosieToasts()
	if (rosie) {
		try {
			rosie.show({ content, subtitle: 'Server Discovery' })
			return
		} catch {}
	}

	if (ToastActionCreators && typeof ToastActionCreators.open === 'function') {
		const openFn = ToastActionCreators.open as (
			arg1: string | { key?: string; content?: string; text?: string },
			arg2?: { key?: string; content?: string; text?: string },
		) => void

		try {
			if (ToastActionCreators.open.length === 1) {
				openFn({ key, content, text: content })
			} else {
				openFn(key, { key, content, text: content })
			}
		} catch {
			try {
				openFn({ key, content, text: content })
			} catch {}
		}
	}
}
