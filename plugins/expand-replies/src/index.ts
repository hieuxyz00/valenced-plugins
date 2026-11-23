import { JsonStorageUpdateMode } from '@valenced/json-storage'
import { setNativeLogger, syncNative } from './native'
import { patchRowGenerator } from './patches/rowGenerator'
import SettingsComponent from './settings'
import { DefaultSettings } from './types'
import type { Settings } from './types'

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: {
		load: true,
		default: DefaultSettings,
	},
	start({ cleanup, jsonStorage, plugin }) {
		if (plugin.startedLate) {
			plugin.requireReload()
			return
		}

		setNativeLogger(plugin)
		patchRowGenerator(cleanup, jsonStorage, plugin)

		const initial = { ...DefaultSettings, ...jsonStorage.cache }
		syncNative(initial)

		cleanup(
			jsonStorage.subscribe((data, mode) => {
				if (mode === JsonStorageUpdateMode.Load) return
				syncNative({ ...DefaultSettings, ...data })
			}),
		)
	},
	stop({ plugin }) {
		syncNative({
			...DefaultSettings,
			maxLines: 1,
			preserveNewlines: false,
			alignWithLine1: true,
			trimContentIndents: false,
		})
		plugin.requireReload()
	},
	SettingsComponent,
})
