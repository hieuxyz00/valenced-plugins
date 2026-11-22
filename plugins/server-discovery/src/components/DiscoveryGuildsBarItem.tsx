import { TableRowAssetIcon } from '@valenced/components'
import { Pressable, StyleSheet, Vibration, View } from 'react-native'
import { DiscoveryState, useDiscoveryActive } from '../state/discoveryState'
import { DefaultSettings } from '../types'
import type { JsonStorage } from '@valenced/json-storage'
import type { Settings } from '../types'

interface DiscoveryGuildsBarItemProps {
	storage?: JsonStorage<Settings>
}

export function DiscoveryGuildsBarItem({
	storage,
}: DiscoveryGuildsBarItemProps) {
	const isActive = useDiscoveryActive()
	const cached = storage?.use?.() ?? storage?.cache
	const settings = (cached as Settings | undefined) ?? DefaultSettings

	if (!settings.enableServerListItem) {
		return null
	}

	const handlePress = () => {
		Vibration.vibrate(50)
		DiscoveryState.setActive(true)
		DiscoveryState.closeDrawer()
	}

	return (
		<View style={styles.container}>
			<View
				style={[
					styles.pill,
					isActive ? styles.pillActive : styles.pillInactive,
				]}
			/>
			<Pressable
				accessibilityLabel="Server Discovery"
				accessibilityRole="button"
				onPress={handlePress}
				style={[
					styles.button,
					isActive ? styles.buttonActive : styles.buttonInactive,
				]}
				hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
			>
				<TableRowAssetIcon name="CompassIcon" />
			</Pressable>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		width: 72,
		height: 56,
		alignItems: 'center',
		justifyContent: 'center',
		position: 'relative',
		marginVertical: 2,
	},
	pill: {
		position: 'absolute',
		left: 0,
		width: 4,
		borderTopRightRadius: 4,
		borderBottomRightRadius: 4,
		backgroundColor: '#ffffff',
	},
	pillActive: {
		height: 40,
	},
	pillInactive: {
		height: 0,
	},
	button: {
		width: 48,
		height: 48,
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
	},
	buttonActive: {
		backgroundColor: '#23a55a',
		borderRadius: 16,
	},
	buttonInactive: {
		backgroundColor: 'rgba(255, 255, 255, 0.08)',
		borderRadius: 24,
	},
})
