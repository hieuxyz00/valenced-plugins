import { ToastActionCreators } from '@valenced/discord/actions'
import { Dispatcher } from '@valenced/discord/common/flux'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { getModuleWithImportedPath } from '@valenced/discord/utils/modules/finders'
import { after } from '@valenced/patcher'
import { beforeJSX } from '@valenced/react/jsx-runtime'
import { cloneElement, isValidElement } from 'react'
import { Pressable, Vibration } from 'react-native'
import { DefaultSettings } from '../types'
import type { JsonStorage } from '@valenced/json-storage'
import type { ElementType, ReactElement, ReactNode } from 'react'
import type { Settings } from '../types'

interface ButtonProps {
	children?: ReactNode
	icon?: unknown
	accessibilityLabel?: string
	accessibilityRole?: string
	accessibilityState?: {
		checked?: boolean
		selected?: boolean
		[key: string]: unknown
	}
	onPress?: (event: unknown) => void
	onLongPress?: (event: unknown) => void
	delayLongPress?: number
	[key: string]: unknown
}

function isNodeWithProps(
	node: unknown,
): node is { props: Record<string, unknown>; type?: unknown } {
	return (
		typeof node === 'object' &&
		node !== null &&
		'props' in node &&
		typeof (node as { props?: unknown }).props === 'object' &&
		(node as { props?: unknown }).props !== null
	)
}

function hasMentionIndicator(target: unknown): boolean {
	if (!target) return false
	if (typeof target === 'string') {
		const lower = target.toLowerCase()
		return lower.includes('@') || lower.includes('mention')
	}
	if (Array.isArray(target)) {
		return target.some(hasMentionIndicator)
	}
	if (isNodeWithProps(target)) {
		const typeName =
			typeof target.type === 'string'
				? target.type
				: typeof (target.type as { name?: unknown })?.name === 'string'
					? (target.type as { name: string }).name
					: ''
		if (/mention|aticon|alternateemail/i.test(typeName)) {
			return true
		}
		const label = target.props.accessibilityLabel
		if (typeof label === 'string' && /mention/i.test(label)) {
			return true
		}
		return hasMentionIndicator(target.props.children)
	}
	return false
}

function isCloseButton(props: Record<string, unknown>): boolean {
	const label =
		typeof props.accessibilityLabel === 'string'
			? props.accessibilityLabel.toLowerCase()
			: ''
	return (
		label.includes('close') ||
		label.includes('cancel') ||
		label.includes('dismiss')
	)
}

function isMentionToggleButtonProps(
	props: Record<string, unknown> | undefined,
): props is ButtonProps {
	if (!props || typeof props !== 'object') return false
	if (typeof props.onPress !== 'function') return false
	if (isCloseButton(props)) return false

	const label =
		typeof props.accessibilityLabel === 'string'
			? props.accessibilityLabel.toLowerCase()
			: ''
	if (label.includes('mention') || label.includes('@')) return true

	if (
		props.accessibilityRole === 'checkbox' ||
		props.accessibilityRole === 'switch'
	) {
		return true
	}

	if (
		props.accessibilityState &&
		typeof props.accessibilityState === 'object' &&
		'checked' in (props.accessibilityState as Record<string, unknown>)
	) {
		return true
	}

	return hasMentionIndicator(props.icon) || hasMentionIndicator(props.children)
}

function isMentionToggleButton(
	node: unknown,
): node is ReactElement<ButtonProps> {
	if (!isValidElement(node)) return false
	return isMentionToggleButtonProps(node.props as Record<string, unknown>)
}

function createLongPressHandler(
	storage: JsonStorage<Settings>,
	origOnLongPress?: (event: unknown) => void,
) {
	return (event: unknown) => {
		try {
			Vibration.vibrate(50)
		} catch {
			// Ignore if vibration fails or is unsupported
		}

		const currentSettings = storage.cache as Settings | undefined
		const currentEnabled = currentSettings?.enabled ?? DefaultSettings.enabled
		const nextEnabled = !currentEnabled
		void storage.set({ enabled: nextEnabled })

		const text = `Auto No-Reply Mention: ${nextEnabled ? 'Enabled' : 'Disabled'}`
		if (ToastActionCreators && typeof ToastActionCreators.open === 'function') {
			try {
				ToastActionCreators.open('no-reply-mention-toggle', {
					text,
					variant: nextEnabled ? 'success' : 'default',
				})
			} catch {
				try {
					const legacyOpen = ToastActionCreators.open as (opts: unknown) => void
					legacyOpen({
						key: 'no-reply-mention-toggle',
						content: text,
					})
				} catch {
					// Ignore toast errors
				}
			}
		}

		const selectedChannelStore = Stores?.SelectedChannelStore as
			| { getChannelId?: () => string | undefined }
			| undefined
		const channelId = selectedChannelStore?.getChannelId?.()
		if (channelId && Dispatcher && typeof Dispatcher.dispatch === 'function') {
			void Dispatcher.dispatch({
				type: 'SET_PENDING_REPLY_SHOULD_MENTION',
				channelId,
				shouldMention: !nextEnabled,
			})
		}

		origOnLongPress?.(event)
	}
}

/**
 * Pure, immutable tree transform that safely clones React elements
 * without modifying frozen properties or throwing on frozen nodes.
 */
function patchTreeWithClone(
	node: unknown,
	storage: JsonStorage<Settings>,
): unknown {
	if (!isValidElement(node)) return node

	if (isMentionToggleButton(node)) {
		const origOnLongPress = node.props.onLongPress
		return cloneElement(node, {
			onLongPress: createLongPressHandler(storage, origOnLongPress),
			delayLongPress: 300,
		})
	}

	const props = node.props as { children?: unknown } | undefined
	if (!props?.children) return node

	const children = props.children

	if (Array.isArray(children)) {
		let hasChanged = false
		const newChildren = children.map(child => {
			const patched = patchTreeWithClone(child, storage)
			if (patched !== child) {
				hasChanged = true
			}
			return patched
		})

		if (hasChanged) {
			return cloneElement(
				node,
				undefined,
				...(newChildren as (
					| ReactElement
					| string
					| number
					| null
					| undefined
				)[]),
			)
		}
		return node
	}

	if (isValidElement(children)) {
		const patched = patchTreeWithClone(children, storage)
		if (patched !== children) {
			return cloneElement(
				node,
				undefined,
				patched as ReactElement | string | number | null | undefined,
			)
		}
	}

	return node
}

export function patchReplyBar(
	cleanup: (cb: () => void) => void,
	storage: JsonStorage<Settings>,
): void {
	// 1. Hook JSX creation directly via beforeJSX (props are mutable and unfrozen)
	if (Design?.IconButton) {
		cleanup(
			beforeJSX(Design.IconButton as ElementType, args => {
				const [, props] = args as [
					unknown,
					Record<string, unknown> | undefined,
					unknown,
				]
				if (isMentionToggleButtonProps(props)) {
					const origOnLongPress = props.onLongPress as
						| ((event: unknown) => void)
						| undefined
					props.onLongPress = createLongPressHandler(storage, origOnLongPress)
					props.delayLongPress = 300
				}
				return args
			}),
		)
	}

	if (Pressable) {
		cleanup(
			beforeJSX(Pressable as ElementType, args => {
				const [, props] = args as [
					unknown,
					Record<string, unknown> | undefined,
					unknown,
				]
				if (isMentionToggleButtonProps(props)) {
					const origOnLongPress = props.onLongPress as
						| ((event: unknown) => void)
						| undefined
					props.onLongPress = createLongPressHandler(storage, origOnLongPress)
					props.delayLongPress = 300
				}
				return args
			}),
		)
	}

	// 2. Hook ChatInputContextBar and ChatInputReplyBar return values with immutable cloning
	const patchElementTree = (result: unknown): unknown => {
		if (!result || typeof result !== 'object') return result
		return patchTreeWithClone(result, storage)
	}

	cleanup(
		getModuleWithImportedPath(
			'modules/chat_input/native/ChatInputContextBar.tsx',
			(mod: unknown) => {
				if (!mod || typeof mod !== 'object') return
				const record = mod as Record<string, unknown>

				if (record.default && typeof record.default === 'object') {
					const def = record.default as Record<string, unknown>
					if (typeof def.type === 'function') {
						cleanup(
							after(
								def as Record<string, () => unknown>,
								'type',
								patchElementTree,
							),
						)
					}
				} else if (typeof record.default === 'function') {
					cleanup(
						after(
							record as Record<string, () => unknown>,
							'default',
							patchElementTree,
						),
					)
				}

				if (typeof record.ChatInputReplyBar === 'function') {
					cleanup(
						after(
							record as Record<string, () => unknown>,
							'ChatInputReplyBar',
							patchElementTree,
						),
					)
				}
			},
		),
	)

	cleanup(
		getModuleWithImportedPath(
			'modules/chat_input/native/ChatInput.tsx',
			(mod: unknown) => {
				if (!mod || typeof mod !== 'object') return
				const record = mod as Record<string, unknown>

				if (record.default && typeof record.default === 'object') {
					const def = record.default as Record<string, unknown>
					if (typeof def.type === 'function') {
						cleanup(
							after(
								def as Record<string, () => unknown>,
								'type',
								patchElementTree,
							),
						)
					}
				} else if (typeof record.default === 'function') {
					cleanup(
						after(
							record as Record<string, () => unknown>,
							'default',
							patchElementTree,
						),
					)
				}
			},
		),
	)
}
