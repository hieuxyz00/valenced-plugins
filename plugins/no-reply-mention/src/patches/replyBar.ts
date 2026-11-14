import { ToastActionCreators } from '@valenced/discord/actions'
import { Dispatcher } from '@valenced/discord/common/flux'
import { Stores } from '@valenced/discord/flux'
import { getModuleWithImportedPath } from '@valenced/discord/utils/modules/finders'
import { after } from '@valenced/patcher'
import { DefaultSettings } from '../types'
import type { JsonStorage } from '@valenced/json-storage'
import type { Settings } from '../types'

export interface PressableNode {
	type: unknown
	key?: string | number | null
	props?: {
		children?: unknown
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

function hasMentionIndicator(children: unknown): boolean {
	if (!children) return false
	if (typeof children === 'string') {
		const lower = children.toLowerCase()
		return lower.includes('@') || lower.includes('mention')
	}
	if (Array.isArray(children)) {
		return children.some(hasMentionIndicator)
	}
	if (isNodeWithProps(children)) {
		const typeName =
			typeof children.type === 'string'
				? children.type
				: typeof (children.type as { name?: unknown })?.name === 'string'
					? (children.type as { name: string }).name
					: ''
		if (/mention|aticon|alternateemail/i.test(typeName)) {
			return true
		}
		const label = children.props.accessibilityLabel
		if (typeof label === 'string' && /mention/i.test(label)) {
			return true
		}
		return hasMentionIndicator(children.props.children)
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

function isMentionToggleButton(node: unknown): node is PressableNode {
	if (!isNodeWithProps(node)) return false
	const props = node.props
	if (typeof props.onPress !== 'function') return false

	if (isCloseButton(props)) return false

	const label =
		typeof props.accessibilityLabel === 'string'
			? props.accessibilityLabel.toLowerCase()
			: ''
	if (label.includes('mention')) return true

	if (
		props.accessibilityRole === 'checkbox' ||
		props.accessibilityRole === 'switch' ||
		(props.accessibilityState &&
			typeof props.accessibilityState === 'object' &&
			'checked' in props.accessibilityState)
	) {
		return true
	}

	return hasMentionIndicator(props.children)
}

export function findMentionToggleButton(
	tree: unknown,
): PressableNode | undefined {
	const candidates: PressableNode[] = []
	const nonCloseButtons: PressableNode[] = []

	function traverse(node: unknown): void {
		if (!node || typeof node !== 'object') return

		if (isNodeWithProps(node) && typeof node.props.onPress === 'function') {
			if (isMentionToggleButton(node)) {
				candidates.push(node as PressableNode)
			} else if (!isCloseButton(node.props)) {
				nonCloseButtons.push(node as PressableNode)
			}
		}

		if (isNodeWithProps(node)) {
			const children = node.props.children
			if (Array.isArray(children)) {
				for (const child of children) traverse(child)
			} else if (children && typeof children === 'object') {
				traverse(children)
			}
		}
	}

	traverse(tree)

	if (candidates.length > 0) {
		return candidates[0]
	}

	if (nonCloseButtons.length === 1) {
		return nonCloseButtons[0]
	}

	return undefined
}

export function patchMentionButton(
	node: PressableNode,
	storage: JsonStorage<Settings>,
): void {
	const origOnLongPress = node.props?.onLongPress

	const handleLongPress = (event: unknown) => {
		const currentSettings = storage.cache as Settings | undefined
		const currentEnabled = currentSettings?.enabled ?? DefaultSettings.enabled
		const nextEnabled = !currentEnabled
		void storage.set({ enabled: nextEnabled })

		const text = `Auto No-Reply Mention: ${nextEnabled ? 'Enabled' : 'Disabled'}`
		if (ToastActionCreators && typeof ToastActionCreators.open === 'function') {
			ToastActionCreators.open('no-reply-mention-toggle', { text })
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

	if (node.props) {
		try {
			if (Object.isFrozen(node.props)) {
				node.props = {
					...node.props,
					onLongPress: handleLongPress,
					delayLongPress: 300,
				}
			} else {
				node.props.onLongPress = handleLongPress
				node.props.delayLongPress = 300
			}
		} catch {
			// Ignore if frozen or unmodifiable
		}
	}
}

export function patchReplyBar(
	cleanup: (cb: () => void) => void,
	storage: JsonStorage<Settings>,
): void {
	const patchTree = (tree: unknown): unknown => {
		if (!tree || typeof tree !== 'object') return tree
		const button = findMentionToggleButton(tree)
		if (button) {
			patchMentionButton(button, storage)
		}
		return tree
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
							after(def as Record<string, () => unknown>, 'type', patchTree),
						)
					}
				} else if (typeof record.default === 'function') {
					cleanup(
						after(
							record as Record<string, () => unknown>,
							'default',
							patchTree,
						),
					)
				}

				if (typeof record.ChatInputReplyBar === 'function') {
					cleanup(
						after(
							record as Record<string, () => unknown>,
							'ChatInputReplyBar',
							patchTree,
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
							after(def as Record<string, () => unknown>, 'type', patchTree),
						)
					}
				} else if (typeof record.default === 'function') {
					cleanup(
						after(
							record as Record<string, () => unknown>,
							'default',
							patchTree,
						),
					)
				}
			},
		),
	)
}
