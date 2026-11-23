import { TableRowAssetIcon } from '@valenced/components'
import {
	addSettingsItemToSection,
	onSettingsModulesLoaded,
	refreshSettings,
	registerSettingsItem,
} from '@valenced/discord/modules/settings'
import { StyleSheet, View } from 'react-native'
import { ServerDiscoveryView } from '../components/ServerDiscoveryView'
import { DISCOVERY_ROUTE_NAME, DISCOVERY_SETTINGS_KEY } from '../constants'
import { DefaultSettings } from '../types'
import type { SettingsItem } from '@valenced/discord/modules/settings'
import type { JsonStorage } from '@valenced/json-storage'
import type { Settings } from '../types'

function ServerDiscoveryRouteScreen({
	storage,
}: {
	storage?: JsonStorage<Settings>
}) {
	const settings = (storage?.cache as Settings | undefined) ?? DefaultSettings
	return (
		<View style={styles.container}>
			<ServerDiscoveryView isModal={false} settings={settings} />
		</View>
	)
}

export function patchSettingsDiscovery(
	storage: JsonStorage<Settings>,
	cleanup: (...fns: Array<() => void>) => void,
): void {
	let undoSection: (() => void) | undefined
	let undoItem: (() => void) | undefined

	const ScreenComponent = () => <ServerDiscoveryRouteScreen storage={storage} />

	const unsubscribeLoaded = onSettingsModulesLoaded(() => {
		const itemDefinition: SettingsItem = {
			parent: null,
			type: 'route',
			useTitle: () => 'Server Discovery',
			IconComponent: () => <TableRowAssetIcon name="CompassIcon" />,
			usePredicate: () => {
				const settings =
					(storage.cache as Settings | undefined) ?? DefaultSettings
				return (
					settings.enableSettingsItem ?? settings.enableSettingsEntry ?? true
				)
			},
			screen: {
				route: DISCOVERY_ROUTE_NAME,
				getComponent: () => ScreenComponent,
			},
		}

		undoItem = registerSettingsItem(DISCOVERY_SETTINGS_KEY, itemDefinition)

		try {
			undoSection = addSettingsItemToSection('VALENCED', DISCOVERY_SETTINGS_KEY)
		} catch {
			try {
				undoSection = addSettingsItemToSection(
					'ACCOUNT',
					DISCOVERY_SETTINGS_KEY,
				)
			} catch {}
		}

		refreshSettings()
	})

	cleanup(() => {
		unsubscribeLoaded()
		undoSection?.()
		undoItem?.()
		try {
			refreshSettings()
		} catch {}
	})
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		width: '100%',
		height: '100%',
	},
})
