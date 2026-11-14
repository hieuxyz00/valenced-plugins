import { initTagModule } from './lib/tagComponent'
import { initPermissionsModule } from './lib/tags'
import { patchChat } from './patches/chat'
import { patchDetails } from './patches/details'
import { patchName } from './patches/name'
import { patchTag } from './patches/tag'
import SettingsComponent from './Settings'
import type { Settings } from './types'

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: {
		load: true,
		default: {
			useRoleColor: false,
			customTags: {},
		},
	},
	start({ cleanup, jsonStorage }) {
		cleanup(
			initPermissionsModule(),
			initTagModule(),
			patchChat(jsonStorage),
			patchTag(),
			patchName(jsonStorage),
			patchDetails(jsonStorage),
		)
	},
	SettingsComponent,
})
