import { after, before, instead } from '@valenced/patcher'
import { onModuleByProps } from '../../../../shared/modules'
import {
	getCurrentUser,
	getMessage,
	getSelectedChannelId,
} from '../../../../shared/stores'
import { DEFAULT_SETTINGS } from '../types'
import type { JsonStorage } from '@valenced/json-storage'
import type { MessageRecord } from '../../../../shared/stores'
import type { DoubleTapSettings } from '../types'

interface TapNativeEvent {
	messageId?: string
	channelId?: string
}

interface TapEvent {
	nativeEvent?: TapNativeEvent
}

interface MessagesHandlersParams {
	getMessage?: (messageId: string) => MessageRecord | undefined
	channelId?: string
}

interface MessagesHandlersInstance {
	params?: MessagesHandlersParams
	handleDoubleTapMessage?: (event: TapEvent) => unknown
	handleTapMessage?: (event: TapEvent) => unknown
	handleInitiateReply?: (event: TapEvent) => unknown
	handleInitiateEdit?: (event: TapEvent) => unknown
	isModalOrActionsheetObstructing?: () => boolean
}

interface MessagesHandlersModule {
	MessagesHandlers: new (...args: never[]) => MessagesHandlersInstance
}

export function patchDoubleTapToReply(
	storage: JsonStorage<DoubleTapSettings>,
): () => void {
	const unpatches: Array<() => void> = []
	const patchedInstances = new WeakSet<MessagesHandlersInstance>()
	let lastTapId = ''
	let lastTapAt = 0
	let lastTriggeredId = ''
	let lastTriggeredAt = 0

	const getSettings = (): DoubleTapSettings => ({
		...DEFAULT_SETTINGS,
		...(storage?.cache ?? {}),
	})

	const resolveMessage = (
		handlers: MessagesHandlersInstance,
		event: TapEvent,
	): MessageRecord | undefined => {
		const msgId = event?.nativeEvent?.messageId
		if (!msgId) return undefined
		const fromParams = handlers.params?.getMessage?.(msgId)
		if (fromParams) return fromParams
		const channelId =
			event?.nativeEvent?.channelId ??
			handlers.params?.channelId ??
			getSelectedChannelId()
		if (!channelId) return undefined
		return getMessage(channelId, msgId)
	}

	const triggerAction = (
		handlers: MessagesHandlersInstance,
		event: TapEvent,
		settings: DoubleTapSettings,
	) => {
		if (handlers.isModalOrActionsheetObstructing?.()) return
		const msgId = event?.nativeEvent?.messageId ?? ''
		if (msgId) {
			lastTriggeredId = msgId
			lastTriggeredAt = Date.now()
		}

		if (
			settings.ownMessageAction === 'edit' &&
			typeof handlers.handleInitiateEdit === 'function'
		) {
			const msg = resolveMessage(handlers, event)
			const authorId = msg?.author?.id
			const currentUserId = getCurrentUser()?.id
			if (authorId && currentUserId && authorId === currentUserId) {
				handlers.handleInitiateEdit(event)
				return
			}
		}

		if (typeof handlers.handleInitiateReply === 'function') {
			handlers.handleInitiateReply(event)
		}
	}

	const attachToInstance = (handlers: MessagesHandlersInstance) => {
		if (!handlers || patchedInstances.has(handlers)) return
		patchedInstances.add(handlers)

		if (typeof handlers.handleDoubleTapMessage === 'function') {
			unpatches.push(
				instead(
					handlers as Required<MessagesHandlersInstance>,
					'handleDoubleTapMessage',
					(args, orig) => {
						const settings = getSettings()
						if (!settings.enabled) {
							return Reflect.apply(orig, handlers, args)
						}
						const event = args[0] as TapEvent
						triggerAction(handlers, event, settings)
						return undefined
					},
				),
			)
		}

		if (typeof handlers.handleTapMessage === 'function') {
			unpatches.push(
				before(
					handlers as Required<MessagesHandlersInstance>,
					'handleTapMessage',
					args => {
						const settings = getSettings()
						if (!settings.enabled || !settings.tapFallback) {
							return args
						}
						const event = args[0] as TapEvent
						const msgId = event?.nativeEvent?.messageId
						if (!msgId) return args

						const now = Date.now()
						const delay = settings.doubleTapDelayMs || 320
						if (
							msgId === lastTapId &&
							now - lastTapAt <= delay &&
							!(
								msgId === lastTriggeredId &&
								now - lastTriggeredAt <= delay + 150
							)
						) {
							lastTapId = ''
							lastTapAt = 0
							triggerAction(handlers, event, settings)
						} else {
							lastTapId = msgId
							lastTapAt = now
						}
						return args
					},
				),
			)
		}
	}

	unpatches.push(
		onModuleByProps<MessagesHandlersModule>(
			['MessagesHandlers'],
			module => {
				if (typeof module?.MessagesHandlers !== 'function') return
				return after(module, 'MessagesHandlers', handlers => {
					attachToInstance(handlers)
					return handlers
				})
			},
			1,
		),
	)

	return () => {
		for (const unpatch of unpatches) {
			try {
				unpatch()
			} catch {}
		}
	}
}
