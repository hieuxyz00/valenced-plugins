import { showToast as showSharedToast } from '../../../../shared/toast'
import type { ToastVariant } from '../../../../shared/toast'

export interface ToastInput {
	content: string
	subtitle?: string
	variant?: ToastVariant
	icon?: number
	key?: string
}

export function setToastContext(_ctx?: unknown): void {}

export function showToast(
	input: string | ToastInput,
	variant?: ToastVariant,
	key?: string,
): void {
	if (typeof input === 'string') {
		showSharedToast({
			text: input,
			variant: variant ?? 'default',
			key,
			keyPrefix: 'pin',
		})
		return
	}
	showSharedToast({
		text: input.content,
		subtitle: input.subtitle,
		variant: input.variant ?? 'default',
		icon: input.icon,
		key: input.key ?? key,
		keyPrefix: 'pin',
	})
}
