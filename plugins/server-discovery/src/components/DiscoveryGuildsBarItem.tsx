import { TableRowAssetIcon } from '@valenced/components'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { Pressable, StyleSheet, Vibration, View } from 'react-native'
import { DiscoveryState, useDiscoveryActive } from '../state/discoveryState'
import { DefaultSettings } from '../types'
import { useThemeTokens } from '../utils/theme'
import type { JsonStorage } from '@valenced/json-storage'
import type { Settings } from '../types'

function getCompassIcon() {
	return lookupGeneratedIconComponent('CompassIcon')
}

interface DiscoveryGuildsBarItemProps {
	storage?: JsonStorage<Settings>
}

export function DiscoveryGuildsBarItem({
	storage,
}: DiscoveryGuildsBarItemProps) {
	const isActive = useDiscoveryActive()
	const tokens = useThemeTokens()
	const CompassIcon = getCompassIcon()
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
					{ backgroundColor: tokens.pillBg },
					isActive ? styles.pillActive : styles.pillInactive,
				]}
			/>
			<Pressable
				accessibilityLabel="Server Discovery"
				accessibilityRole="button"
				onPress={handlePress}
				style={[
					styles.button,
					isActive
						? [styles.buttonActive, { backgroundColor: tokens.statusPositive }]
						: [
								styles.buttonInactive,
								{ backgroundColor: tokens.backgroundModifierAccent },
							],
				]}
				hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
			>
				{CompassIcon ? (
					<CompassIcon
						color={isActive ? '#ffffff' : tokens.iconDefault}
						size="md"
					/>
				) : (
					<TableRowAssetIcon name="CompassIcon" />
				)}
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
		borderRadius: 16,
	},
	buttonActive: {
		borderRadius: 16,
	},
	buttonInactive: {
		borderRadius: 16,
	},
})
