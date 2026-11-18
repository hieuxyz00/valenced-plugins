import { ToastActionCreators } from '@valenced/discord/actions'
import { Dispatcher } from '@valenced/discord/common/flux'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { getModuleWithImportedPath } from '@valenced/discord/utils/modules/finders'
import { after, before } from '@valenced/patcher'
import { beforeJSX } from '@valenced/react/jsx-runtime'
import { cloneElement, isValidElement } from 'react'
import { Pressable } from 'react-native'
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
	testID?: string
	[key: string]: unknown
}

function hasPendingReply(): boolean {
	const selectedChannelStore = Stores?.SelectedChannelStore as
		| { getChannelId?: () => string | undefined }
		| undefined
	const channelId = selectedChannelStore?.getChannelId?.()
	if (!channelId) return false
	const pendingReplyStore = Stores?.PendingReplyStore as
		| {
				getPendingReply?: (
					id: string,
				) => { showMentionToggle?: boolean } | undefined
		  }
		| undefined
	const pending = pendingReplyStore?.getPendingReply?.(channelId)
	return Boolean(pending && pending.showMentionToggle !== false)
}

function isMentionButtonProps(
	props: Record<string, unknown> | undefined,
): props is ButtonProps {
	if (!props || typeof props !== 'object') return false
	if (typeof props.onPress !== 'function') return false
	if (props.testID === 'valenced-translator-chat-button') return false
	if ((props.onLongPress as { _isNrm?: boolean })?._isNrm) return false

	if (
		props.accessibilityState &&
		typeof props.accessibilityState === 'object' &&
		typeof (props.accessibilityState as { checked?: unknown }).checked ===
			'boolean'
	) {
		return true
	}

	return false
}

function createLongPressHandler(
	storage: JsonStorage<Settings>,
	origOnLongPress?: (event: unknown) => void,
) {
	const handler = (event: unknown) => {
		if (
			event &&
			typeof event === 'object' &&
			'stopPropagation' in event &&
			typeof (event as { stopPropagation?: unknown }).stopPropagation ===
				'function'
		) {
			;(event as { stopPropagation: () => void }).stopPropagation()
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
				} catch {}
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

	;(handler as { _isNrm?: boolean })._isNrm = true
	return handler
}

function patchTreeWithClone(
	node: unknown,
	storage: JsonStorage<Settings>,
): unknown {
	if (!isValidElement(node)) return node

	const nodeProps = node.props as Record<string, unknown> | undefined

	if (isMentionButtonProps(nodeProps)) {
		const origOnLongPress = (nodeProps as ButtonProps).onLongPress
		return cloneElement(node as ReactElement<ButtonProps>, {
			onLongPress: createLongPressHandler(storage, origOnLongPress),
			delayLongPress: 300,
		})
	}

	if (!nodeProps?.children) return node

	const children = nodeProps.children

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

function patchChatInputTree(
	result: unknown,
	storage: JsonStorage<Settings>,
): unknown {
	if (!isValidElement(result)) return result
	const props = result.props as { children?: unknown } | undefined
	if (!props?.children) return result
	const children = props.children
	if (Array.isArray(children)) {
		let hasChanged = false
		const newChildren = children.map(child => {
			if (!isValidElement(child)) return child
			const patched = patchTreeWithClone(child, storage)
			if (patched !== child) {
				hasChanged = true
			}
			return patched
		})
		if (hasChanged) {
			return cloneElement(
				result,
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
	}
	return result
}

export function patchReplyBar(
	cleanup: (cb: () => void) => void,
	storage: JsonStorage<Settings>,
): void {
	let isRenderingReplyBar = false
	let activeUnhook: (() => void) | null = null

	const hookProps = <T extends [ElementType, unknown, unknown?]>(
		args: T,
	): T => {
		const props = args[1] as Record<string, unknown> | undefined
		if (isMentionButtonProps(props)) {
			const origOnLongPress = props.onLongPress as
				| ((event: unknown) => void)
				| undefined
			props.onLongPress = createLongPressHandler(storage, origOnLongPress)
			props.delayLongPress = 300
		}
		return args
	}

	const updateDynamicHooks = () => {
		const shouldHook = isRenderingReplyBar || hasPendingReply()
		if (shouldHook && !activeUnhook) {
			const unhooks: (() => void)[] = []
			if (Pressable) {
				unhooks.push(
					beforeJSX(Pressable as ElementType, args => hookProps(args)),
				)
			}
			if (Design?.IconButton) {
				unhooks.push(
					beforeJSX(Design.IconButton as ElementType, args => hookProps(args)),
				)
			}
			activeUnhook = () => {
				for (const u of unhooks) {
					u()
				}
			}
		} else if (!shouldHook && activeUnhook) {
			activeUnhook()
			activeUnhook = null
		}
	}

	updateDynamicHooks()

	cleanup(() => {
		if (activeUnhook) {
			activeUnhook()
			activeUnhook = null
		}
	})

	const pendingReplyStore = Stores?.PendingReplyStore as
		| {
				addChangeListener?: (cb: () => void) => void
				removeChangeListener?: (cb: () => void) => void
		  }
		| undefined

	if (pendingReplyStore?.addChangeListener) {
		const onStoreChange = () => {
			updateDynamicHooks()
		}
		pendingReplyStore.addChangeListener(onStoreChange)
		cleanup(() => {
			pendingReplyStore.removeChangeListener?.(onStoreChange)
		})
	}

	const selectedChannelStore = Stores?.SelectedChannelStore as
		| {
				addChangeListener?: (cb: () => void) => void
				removeChangeListener?: (cb: () => void) => void
		  }
		| undefined

	if (selectedChannelStore?.addChangeListener) {
		const onChannelChange = () => {
			updateDynamicHooks()
		}
		selectedChannelStore.addChangeListener(onChannelChange)
		cleanup(() => {
			selectedChannelStore.removeChangeListener?.(onChannelChange)
		})
	}

	const patchContextBarTree = (result: unknown): unknown => {
		if (!result || typeof result !== 'object') return result
		return patchTreeWithClone(result, storage)
	}

	cleanup(
		getModuleWithImportedPath(
			'modules/chat_input/native/ChatInputContextBar.tsx',
			(mod: unknown) => {
				if (!mod || typeof mod !== 'object') return
				const record = mod as Record<string, unknown>

				const wrapRender = (
					target: Record<string, () => unknown>,
					key: string,
				) => {
					cleanup(
						before(target, key, args => {
							isRenderingReplyBar = true
							updateDynamicHooks()
							return args
						}),
					)
					cleanup(
						after(target, key, (result: unknown) => {
							isRenderingReplyBar = false
							updateDynamicHooks()
							return patchContextBarTree(result)
						}),
					)
				}

				if (record.default && typeof record.default === 'object') {
					const def = record.default as Record<string, unknown>
					if (typeof def.type === 'function') {
						wrapRender(def as Record<string, () => unknown>, 'type')
					}
				} else if (typeof record.default === 'function') {
					wrapRender(record as Record<string, () => unknown>, 'default')
				}

				if (typeof record.ChatInputReplyBar === 'function') {
					wrapRender(
						record as Record<string, () => unknown>,
						'ChatInputReplyBar',
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
								(result: unknown) => patchChatInputTree(result, storage),
							),
						)
					}
				} else if (typeof record.default === 'function') {
					cleanup(
						after(
							record as Record<string, () => unknown>,
							'default',
							(result: unknown) => patchChatInputTree(result, storage),
						),
					)
				}
			},
		),
	)
}
