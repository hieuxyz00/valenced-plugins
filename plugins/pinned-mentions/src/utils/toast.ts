import { ToastActionCreators } from '@valenced/discord/actions'

export type ToastVariant =
	| 'default'
	| 'success'
	| 'critical'
	| 'warning'
	| 'info'

export interface ToastOptions {
	content: string
	subtitle?: string
	variant?: ToastVariant
	icon?: number
	key?: string
}

interface ToastsApi {
	show?: (opts: string | Record<string, unknown>) => unknown
}

interface ToastContextInput {
	plugin?: unknown
	unscoped?: unknown
}

declare const valenced: unknown

let pluginApiRef: { toasts?: ToastsApi } | undefined
let unscopedRef: { toasts?: ToastsApi } | undefined
let toastCounter = 0

export function setToastContext(ctx: ToastContextInput): void {
	if (ctx.plugin && typeof ctx.plugin === 'object' && 'api' in ctx.plugin) {
		const p = ctx.plugin as { api?: { toasts?: ToastsApi } }
		pluginApiRef = p.api
	} else {
		pluginApiRef = undefined
	}
	if (ctx.unscoped && typeof ctx.unscoped === 'object') {
		const u = ctx.unscoped as { toasts?: ToastsApi }
		unscopedRef = u
	} else {
		unscopedRef = undefined
	}
}

function getToastsApi(): ToastsApi | undefined {
	try {
		if (typeof pluginApiRef?.toasts?.show === 'function') {
			return pluginApiRef.toasts
		}
		if (typeof unscopedRef?.toasts?.show === 'function') {
			return unscopedRef.toasts
		}
	} catch {}

	try {
		const g = globalThis as Record<string, unknown>
		const valencedObj = (
			typeof valenced !== 'undefined' ? valenced : g.valenced
		) as Record<string, unknown> | undefined

		if (typeof (valencedObj?.toasts as ToastsApi)?.show === 'function') {
			return valencedObj!.toasts as ToastsApi
		}
		const u = valencedObj?.unscoped as Record<string, unknown> | undefined
		if (typeof (u?.toasts as ToastsApi)?.show === 'function') {
			return u!.toasts as ToastsApi
		}
		if (typeof (g.toasts as ToastsApi)?.show === 'function') {
			return g.toasts as ToastsApi
		}
	} catch {}

	return undefined
}

export function showToast(
	input: string | ToastOptions,
	key?: string,
	variant?: ToastVariant,
): void {
	toastCounter += 1
	const opts: ToastOptions =
		typeof input === 'string'
			? {
					content: input,
					key,
					variant: variant ?? 'default',
				}
			: {
					variant: 'default',
					...input,
				}

	const toastKey = opts.key ?? key ?? `pin-${Date.now()}-${toastCounter}`

	try {
		const toastsApi = getToastsApi()
		if (typeof toastsApi?.show === 'function') {
			toastsApi.show({
				content: opts.content,
				subtitle: opts.subtitle ?? 'Pinned Mentions',
				variant: opts.variant ?? 'default',
				...(opts.icon !== undefined ? { icon: opts.icon } : {}),
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
				content: opts.content,
				text: opts.content,
				...(opts.icon !== undefined ? { icon: opts.icon } : {}),
			})
		} else {
			openFn(toastKey, {
				text: opts.content,
				content: opts.content,
				...(opts.icon !== undefined ? { icon: opts.icon } : {}),
			})
		}
	} catch {
		try {
			const fallbackFn = ToastActionCreators.open as unknown as (
				opts: unknown,
			) => void
			fallbackFn({
				key: toastKey,
				content: opts.content,
				text: opts.content,
				...(opts.icon !== undefined ? { icon: opts.icon } : {}),
			})
		} catch {}
	}
}
