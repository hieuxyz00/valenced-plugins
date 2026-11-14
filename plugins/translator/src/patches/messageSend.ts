import { getModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { translateText } from '../translator'
import { DefaultSettings, isChannelAutoTranslateSend } from '../types'
import type { JsonStorage } from '@valenced/json-storage'
import type { Settings } from '../types'

export interface BasicMessageData {
	content?: string
	[key: string]: unknown
}

export interface MessageActionCreatorsModule {
	sendMessage: (
		channelId: string,
		data: BasicMessageData,
		...rest: unknown[]
	) => Promise<unknown>
}

/**
 * Patch MessageActionCreators.sendMessage to automatically translate outgoing message text
 * if the active channel or global setting is configured for send auto-translation.
 */
export function patchMessageSend(
	cleanup: (cb: () => void) => void,
	storage: JsonStorage<Settings>,
	showToast?: (msg: string) => void,
): void {
	cleanup(
		getModules(
			withProps<MessageActionCreatorsModule>('sendMessage'),
			MessageActionCreators => {
				const unpatch = instead(
					MessageActionCreators,
					'sendMessage',
					async (args, original) => {
						const channelId = args[0] as string | undefined
						const messageData = args[1] as BasicMessageData | undefined
						const settings: Settings = {
							...DefaultSettings,
							...(storage.cache as Partial<Settings> | undefined),
						}

						if (
							channelId &&
							messageData &&
							typeof messageData.content === 'string' &&
							messageData.content.trim().length > 0 &&
							!messageData.content.startsWith('/') &&
							!messageData.content.startsWith('!') &&
							isChannelAutoTranslateSend(channelId, settings)
						) {
							const originalContent = messageData.content
							try {
								const res = await translateText(
									settings.provider,
									originalContent,
									settings.sendSourceLang || 'auto',
									settings.sendTargetLang || 'en',
								)
								messageData.content = res.text
							} catch (error) {
								const message =
									error instanceof Error ? error.message : String(error)
								showToast?.(
									`Auto-translate failed; sending original message: ${message}`,
								)
								messageData.content = originalContent
							}
						}

						return Reflect.apply(original, MessageActionCreators, args)
					},
				)
				cleanup(unpatch)
			},
		),
	)
}
