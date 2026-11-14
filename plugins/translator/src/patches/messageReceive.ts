import { onFluxEventDispatched, Stores } from '@valenced/discord/flux'
import { DefaultSettings, isChannelAutoTranslateRev } from '../types'
import type { JsonStorage } from '@valenced/json-storage'
import type { DiscordMessage, Settings } from '../types'

/**
 * Patch incoming flux events to automatically translate messages arriving in revChannels.
 * Self-authored messages are strictly bypassed.
 */
export function patchMessageReceive(
	cleanup: (cb: () => void) => void,
	storage: JsonStorage<Settings>,
	onTranslateMessage: (
		message: DiscordMessage,
		storage: JsonStorage<Settings>,
	) => Promise<void>,
): void {
	cleanup(
		onFluxEventDispatched('MESSAGE_CREATE', evt => {
			if (!evt) return evt

			const message = (evt as { message?: DiscordMessage }).message
			if (!message?.id) return evt
			if (message.state === 'SENDING') return evt

			// Skip bot messages
			if (message.author?.bot) {
				return evt
			}

			// Skip system messages (only allow default 0 and reply 19)
			if (
				message.type !== undefined &&
				message.type !== 0 &&
				message.type !== 19
			) {
				return evt
			}

			const channelId =
				message.channel_id ?? (evt as { channelId?: string }).channelId
			if (!channelId) return evt

			const hasContent = Boolean(message.content?.trim())
			const hasEmbeds = Boolean(
				Array.isArray(message.embeds) && message.embeds.length > 0,
			)
			const hasComponents = Boolean(
				Array.isArray(message.components) && message.components.length > 0,
			)
			if (!hasContent && !hasEmbeds && !hasComponents) return evt

			// Skip messages sent by the current user
			const currentUserId = (
				Stores?.UserStore as
					| { getCurrentUser?: () => { id?: string } }
					| undefined
			)?.getCurrentUser?.()?.id
			if (currentUserId && message.author?.id === currentUserId) {
				return evt
			}

			const settings: Settings = {
				...DefaultSettings,
				...(storage.cache as Partial<Settings> | undefined),
			}
			if (isChannelAutoTranslateRev(channelId, settings)) {
				void onTranslateMessage(message, storage)
			}

			return evt
		}),
	)
}
