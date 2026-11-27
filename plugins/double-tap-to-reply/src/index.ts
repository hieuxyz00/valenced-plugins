import { patchDoubleTapToReply } from './patches/doubleTap'
import SettingsComponent from './settings'
import { DEFAULT_SETTINGS } from './types'
import type { DoubleTapSettings } from './types'

export default plugin<{ jsonStorage: DoubleTapSettings }>({
	jsonStorage: {
		load: true,
		default: DEFAULT_SETTINGS,
	},
	SettingsComponent,
	start({ cleanup, jsonStorage }) {
		cleanup(patchDoubleTapToReply(jsonStorage))
	},
})
