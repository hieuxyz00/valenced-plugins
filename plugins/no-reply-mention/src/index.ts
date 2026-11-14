import { onFluxEventDispatched } from '@valenced/discord/flux'
import { patchReplyBar } from './patches/replyBar'
import SettingsComponent from './settings'
import { DefaultSettings } from './types'
import type { PendingReplyEvent, Settings } from './types'

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: {
		load: true,
		default: DefaultSettings,
	},
	start({ cleanup, jsonStorage }) {
		const unhookCreate = onFluxEventDispatched<PendingReplyEvent>(
			'CREATE_PENDING_REPLY',
			event => {
				const settings = jsonStorage.cache as Settings | undefined
				const isEnabled = settings?.enabled ?? DefaultSettings.enabled
				if (isEnabled && event) {
					event.shouldMention = false
				}
				return event
			},
		)

		const unhookCreateShallow = onFluxEventDispatched<PendingReplyEvent>(
			'CREATE_SHALLOW_PENDING_REPLY',
			event => {
				const settings = jsonStorage.cache as Settings | undefined
				const isEnabled = settings?.enabled ?? DefaultSettings.enabled
				if (isEnabled && event) {
					event.shouldMention = false
				}
				return event
			},
		)

		cleanup(unhookCreate, unhookCreateShallow)

		patchReplyBar(cleanup, jsonStorage)
	},
	SettingsComponent,
})
