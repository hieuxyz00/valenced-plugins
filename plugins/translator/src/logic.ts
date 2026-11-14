import type { Settings } from './types'

export interface MockReactElement {
	type: string | unknown
	key?: string | number | null
	props?: {
		children?: unknown
		accessibilityLabel?: string
		accessibilityState?: { selected?: boolean; checked?: boolean }
		onPress?: () => void
		onLongPress?: () => void
		value?: boolean
		onValueChange?: (val: boolean) => void
		label?: string
		subLabel?: string
		currentLang?: string
		onSelect?: (code: string) => void
		[key: string]: unknown
	}
	[key: string]: unknown
}

/** Pure helper to inject translator button into a mock or real action button React tree. */
export function injectChatBarTranslatorButton(
	actionsTree: MockReactElement,
	settings: Settings,
	onPress: () => void,
	onLongPress?: () => void,
): MockReactElement {
	if (!settings.chatButtonEnabled) {
		const existingChildren = actionsTree.props?.children
		const childrenArray = Array.isArray(existingChildren)
			? (existingChildren as unknown[]).filter(
					c =>
						!(
							typeof c === 'object' &&
							c !== null &&
							'key' in c &&
							(c as { key?: unknown }).key === 'valenced-translator-chat-button'
						),
				)
			: []
		return {
			...actionsTree,
			props: {
				...actionsTree.props,
				children: childrenArray,
			},
		}
	}

	const buttonElement: MockReactElement = {
		type: 'TranslatorActionButton',
		key: 'valenced-translator-chat-button',
		props: {
			accessibilityLabel: 'Translator',
			accessibilityState: {
				selected: settings.autoTranslateSend,
				checked: settings.autoTranslateSend,
			},
			onPress,
			onLongPress,
		},
	}

	const existing = actionsTree.props?.children
	const childrenArray: unknown[] = Array.isArray(existing)
		? [...existing].filter(
				c =>
					!(
						typeof c === 'object' &&
						c !== null &&
						'key' in c &&
						(c as { key?: unknown }).key === 'valenced-translator-chat-button'
					),
			)
		: existing
			? [existing]
			: []

	if (settings.chatButtonPosition === 'right') {
		childrenArray.unshift(buttonElement)
	} else {
		childrenArray.push(buttonElement)
	}

	return {
		...actionsTree,
		props: {
			...actionsTree.props,
			children: childrenArray,
		},
	}
}

/** Find a node in React fiber or element tree matching a predicate. */
export function findInReactFiber<T>(
	fiber: unknown,
	predicate: (node: unknown) => node is T,
): T | undefined {
	if (!fiber || typeof fiber !== 'object') return undefined
	if (predicate(fiber)) return fiber

	const queue: unknown[] = [fiber]
	const visited = new Set<unknown>()

	while (queue.length > 0) {
		const curr = queue.shift()
		if (!curr || typeof curr !== 'object' || visited.has(curr)) continue
		visited.add(curr)

		if (predicate(curr)) return curr

		const record = curr as Record<string, unknown>
		if (record.props && typeof record.props === 'object') {
			const props = record.props as Record<string, unknown>
			if (Array.isArray(props.children)) {
				for (const child of props.children) {
					if (child && typeof child === 'object') {
						if (predicate(child)) return child
						queue.push(child)
					}
				}
			} else if (props.children && typeof props.children === 'object') {
				if (predicate(props.children)) return props.children as unknown as T
				queue.push(props.children)
			}
		}

		if (record.child && typeof record.child === 'object') {
			queue.push(record.child)
		}
		if (record.sibling && typeof record.sibling === 'object') {
			queue.push(record.sibling)
		}
	}
	return undefined
}
