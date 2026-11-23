import { fetchDiscoveryCategories } from './api/discoveryApi'
import { patchDiscoveryView } from './patches/discoveryViewPatch'
import { patchGuildsBar } from './patches/guildsBarPatch'
import { patchSettingsDiscovery } from './patches/settingsPatch'
import SettingsComponent from './settings'
import { initGuildChangeListener } from './state/discoveryState'
import { DefaultSettings } from './types'
import { resetThemeOverrides, setThemeOverrides } from './utils/theme'
import type { Settings } from './types'

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: {
		load: true,
		default: DefaultSettings,
	},
	start({ cleanup, jsonStorage, plugin }) {
		if (plugin.startedLate) {
			plugin.requireReload()
		}

		if (jsonStorage.cache?.themeOverrides) {
			setThemeOverrides(jsonStorage.cache.themeOverrides)
		}
		if (typeof jsonStorage.subscribe === 'function') {
			cleanup(
				jsonStorage.subscribe(newSettings => {
					setThemeOverrides(newSettings.themeOverrides)
				}),
			)
		}

		try {
			void fetchDiscoveryCategories()
		} catch (err) {
			plugin.reportError(err)
		}

		try {
			initGuildChangeListener(cleanup)
		} catch (err) {
			plugin.reportError(err)
		}

		try {
			patchSettingsDiscovery(jsonStorage, cleanup)
		} catch (err) {
			plugin.reportError(err)
		}

		try {
			patchGuildsBar(jsonStorage, cleanup)
		} catch (err) {
			plugin.reportError(err)
		}

		try {
			patchDiscoveryView(jsonStorage, cleanup)
		} catch (err) {
			plugin.reportError(err)
		}
	},
	stop({ plugin }) {
		resetThemeOverrides()
		plugin.requireReload()
	},
	SettingsComponent,
})
