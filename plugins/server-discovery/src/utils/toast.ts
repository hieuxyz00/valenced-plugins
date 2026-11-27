import { showToast as showSharedToast } from '../../../../shared/toast'
import type { ToastVariant } from '../../../../shared/toast'

export function showToast(
	content: string,
	variantOrKey?: ToastVariant | string,
	customKey?: string,
): void {
	const isVariant =
		variantOrKey === 'default' ||
		variantOrKey === 'success' ||
		variantOrKey === 'critical' ||
		variantOrKey === 'warning' ||
		variantOrKey === 'info'
	showSharedToast({
		text: content,
		variant: isVariant ? (variantOrKey as ToastVariant) : 'default',
		key: isVariant ? customKey : variantOrKey,
		keyPrefix: 'server-discovery',
	})
}
