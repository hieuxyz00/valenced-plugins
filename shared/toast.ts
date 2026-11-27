import { getAssetIdByName } from '@valenced/assets'
import { ToastActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import type { ComponentType, ReactNode } from 'react'

export type ToastVariant =
	| 'default'
	| 'success'
	| 'critical'
	| 'warning'
	| 'info'

export type ToastIconOption =
	| string
	| number
	| ComponentType<unknown>
	| { alt: string; src: string; type: 'emoji' }
	| { alt: string; src: string; type: 'avatar' }
	| { name: string; src: string | null; type: 'guild' }

export interface ToastOptions {
	text?: ReactNode
	content?: string
	subtitle?: string
	variant?: ToastVariant
	icon?: ToastIconOption
	iconColor?: string
	secondaryIconColor?: string
	duration?: number
	key?: string
	keyPrefix?: string
}

let toastCounter = 0

const VARIANT_ICON_NAMES: Record<Exclude<ToastVariant, 'default'>, string> = {
	success: 'CircleCheckIcon',
	critical: 'CircleXIcon',
	warning: 'WarningIcon',
	info: 'CircleInformationIcon',
}

function resolveToastIcon(
	icon: ToastIconOption | undefined,
	variant: ToastVariant,
): unknown {
	if (typeof icon === 'number' || typeof icon === 'function') return icon
	if (typeof icon === 'object' && icon !== null) return icon
	if (typeof icon === 'string' && icon.trim()) {
		try {
			const id = getAssetIdByName(icon.trim())
			if (typeof id === 'number') return id
		} catch {}
	}
	if (variant !== 'default') {
		try {
			const id = getAssetIdByName(VARIANT_ICON_NAMES[variant])
			if (typeof id === 'number') return id
		} catch {}
	}
	return undefined
}

function toDiscordVariant(
	variant: ToastVariant,
): 'default' | 'success' | 'critical' {
	if (variant === 'success' || variant === 'critical') return variant
	return 'default'
}

export function showToast(
	textOrOptions: string | ToastOptions,
	variant: ToastVariant = 'default',
	keyPrefix = 'hieuxyz-toast',
): void {
	const opts: ToastOptions =
		typeof textOrOptions === 'string'
			? { text: textOrOptions, variant, keyPrefix }
			: textOrOptions

	const resolvedVariant = opts.variant ?? variant
	const rawText = opts.text ?? opts.content
	if (!rawText) return

	const displayText =
		opts.subtitle && typeof rawText === 'string'
			? `${opts.subtitle}: ${rawText}`
			: rawText
	toastCounter += 1
	const toastKey =
		opts.key ?? `${opts.keyPrefix ?? keyPrefix}-${Date.now()}-${toastCounter}`
	const resolvedIcon = resolveToastIcon(opts.icon, resolvedVariant)
	const discordVariant = toDiscordVariant(resolvedVariant)

	if (ToastActionCreators && typeof ToastActionCreators.open === 'function') {
		try {
			const openFn = ToastActionCreators.open as unknown as (
				arg1: unknown,
				arg2?: unknown,
			) => void

			if (ToastActionCreators.open.length === 1) {
				openFn({
					key: toastKey,
					content:
						typeof displayText === 'string' ? displayText : String(displayText),
					text: displayText,
					...(resolvedIcon !== undefined ? { icon: resolvedIcon } : {}),
					...(opts.iconColor ? { iconColor: opts.iconColor } : {}),
					...(opts.duration !== undefined
						? { toastDurationMs: opts.duration }
						: {}),
				})
			} else {
				openFn(toastKey, {
					text: displayText,
					variant: discordVariant,
					...(resolvedIcon !== undefined ? { icon: resolvedIcon } : {}),
					...(opts.iconColor ? { iconColor: opts.iconColor } : {}),
					...(opts.secondaryIconColor
						? { secondaryIconColor: opts.secondaryIconColor }
						: {}),
					...(opts.duration !== undefined ? { duration: opts.duration } : {}),
				})
			}
			return
		} catch {}
	}

	try {
		const designShow = (
			Design as unknown as {
				showToast?: (options: Record<string, unknown>) => void
			}
		)?.showToast
		if (typeof designShow === 'function') {
			designShow({
				key: toastKey,
				text: displayText,
				variant: discordVariant,
				...(resolvedIcon !== undefined ? { icon: resolvedIcon } : {}),
				...(opts.iconColor ? { iconColor: opts.iconColor } : {}),
				...(opts.secondaryIconColor
					? { secondaryIconColor: opts.secondaryIconColor }
					: {}),
				...(opts.duration !== undefined ? { duration: opts.duration } : {}),
			})
		}
	} catch {}
}

export function showSuccessToast(
	text: string,
	options?: Omit<ToastOptions, 'text' | 'variant'>,
): void {
	showToast({ ...options, text, variant: 'success' })
}

export function showErrorToast(
	text: string,
	options?: Omit<ToastOptions, 'text' | 'variant'>,
): void {
	showToast({ ...options, text, variant: 'critical' })
}

export function showWarningToast(
	text: string,
	options?: Omit<ToastOptions, 'text' | 'variant'>,
): void {
	showToast({ ...options, text, variant: 'warning' })
}

export function showInfoToast(
	text: string,
	options?: Omit<ToastOptions, 'text' | 'variant'>,
): void {
	showToast({ ...options, text, variant: 'info' })
}

export function closeToast(): void {
	try {
		ToastActionCreators?.close?.()
	} catch {}
}
