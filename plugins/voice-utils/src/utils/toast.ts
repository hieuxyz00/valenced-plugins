import { showToast as showSharedToast } from '../../../../shared/toast'
import type { ToastVariant } from '../../../../shared/toast'

function inferVariant(content: string, key?: string): ToastVariant {
	const k = (key ?? '').toLowerCase()
	if (
		k.includes('error') ||
		k.includes('fail') ||
		k.includes('empty') ||
		content.startsWith('Failed')
	) {
		return 'critical'
	}
	if (k.includes('success') || k.includes('cleared')) {
		return 'success'
	}
	return 'default'
}

export function showToast(
	content: string,
	keyOrVariant?: string,
	key?: string,
): void {
	const isVariant =
		keyOrVariant === 'default' ||
		keyOrVariant === 'success' ||
		keyOrVariant === 'critical' ||
		keyOrVariant === 'warning' ||
		keyOrVariant === 'info'
	const resolvedKey = isVariant ? key : keyOrVariant
	const resolvedVariant = isVariant
		? (keyOrVariant as ToastVariant)
		: inferVariant(content, resolvedKey)

	showSharedToast({
		text: content,
		variant: resolvedVariant,
		key: resolvedKey,
		keyPrefix: 'voice-utils',
	})
}
