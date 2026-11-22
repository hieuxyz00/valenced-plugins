import { patchAutocompleteRow } from './patches/autocompleteRow'
import { patchMemberActionSheet } from './patches/memberActionSheet'
import { patchMentionQuery } from './patches/mentionQuery'
import SettingsComponent from './settings'
import { DefaultSettings } from './types'
import { setToastContext } from './utils/toast'
import type { Settings } from './types'

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: {
		load: true,
		default: DefaultSettings,
	},
	start({ cleanup, jsonStorage, plugin, unscoped }) {
		setToastContext({ plugin, unscoped })

		if (plugin.startedLate) {
			plugin.requireReload()
			return
		}

		try {
			patchMentionQuery(cleanup, jsonStorage)
		} catch (err) {
			plugin.reportError(err)
		}

		try {
			patchAutocompleteRow(cleanup, jsonStorage)
		} catch (err) {
			plugin.reportError(err)
		}

		try {
			patchMemberActionSheet(cleanup, jsonStorage)
		} catch (err) {
			plugin.reportError(err)
		}
	},
	stop({ plugin }) {
		plugin.requireReload()
	},
	SettingsComponent,
})
