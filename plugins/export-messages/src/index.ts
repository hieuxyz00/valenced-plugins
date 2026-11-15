import { patchMessageActionSheet } from './patches/messageActionSheet'
import SettingsComponent from './settings'
import { DefaultSettings } from './types'
import type { Settings } from './types'

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: {
		load: true,
		default: DefaultSettings,
	},
	start({ cleanup, jsonStorage }) {
		patchMessageActionSheet(cleanup, jsonStorage)
	},
	SettingsComponent,
})
