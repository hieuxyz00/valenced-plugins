import { TableRowAssetIcon } from '@valenced/components'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { Pressable, StyleSheet, Vibration, View } from 'react-native'
import { DiscoveryState, useDiscoveryActive } from '../state/discoveryState'
import { DefaultSettings } from '../types'
import { useStockTileStyles, useThemeTokens } from '../utils/theme'
import type { JsonStorage } from '@valenced/json-storage'
import type { ComponentType, ReactElement } from 'react'
import type { Settings } from '../types'

function getCompassIcon(): ComponentType<{
	color?: string
	size?: string
}> | null {
	const icon = lookupGeneratedIconComponent('CompassIcon')
	return icon as ComponentType<{ color?: string; size?: string }> | null
}

interface DiscoveryGuildsBarItemProps {
	storage?: JsonStorage<Settings>
}

export function DiscoveryGuildsBarItem({
	storage,
}: DiscoveryGuildsBarItemProps): ReactElement | null {
	const isActive = useDiscoveryActive()
	const tokens = useThemeTokens()
	const stock = useStockTileStyles()
	const cached = storage?.use?.() ?? storage?.cache
	const settings = (cached as Settings | undefined) ?? DefaultSettings

	if (!settings.enableServerListItem) {
		return null
	}

	const handlePress = () => {
		try {
			Vibration.vibrate(50)
		} catch {}
		DiscoveryState.setActive(true)
		DiscoveryState.closeDrawer()
	}

	const CompassIcon = getCompassIcon()

	const activeBg = tokens.statusOnline || '#23a55a'
	const inactiveBg = tokens.guildBarIconBackgroundDefault || '#97979f1f'
	const pillColor = tokens.pillBg || '#ffffff'
	const iconColor = isActive
		? '#ffffff'
		: tokens.guildBarIconDefault || tokens.iconDefault

	return (
		<View style={[styles.pressableWrapper, stock.pressableWrapper]}>
			<View
				style={[
					styles.pill,
					{ backgroundColor: pillColor },
					isActive ? styles.pillActive : styles.pillInactive,
				]}
			/>
			<Pressable
				accessibilityLabel="Server Discovery"
				accessibilityRole="button"
				accessibilityState={{ selected: isActive }}
				onPress={handlePress}
				android_ripple={{
					color: tokens.backgroundModifierSelected,
					borderless: false,
				}}
				hitSlop={{ top: 4, bottom: 4, left: 12, right: 12 }}
				style={[
					styles.tile,
					stock.itemShape,
					{ backgroundColor: isActive ? activeBg : inactiveBg },
				]}
			>
				{CompassIcon ? (
					<CompassIcon color={iconColor} size="md" />
				) : (
					<TableRowAssetIcon name="CompassIcon" />
				)}
			</Pressable>
		</View>
	)
}

const styles = StyleSheet.create({
	pressableWrapper: {
		position: 'relative',
		paddingTop: 6,
		paddingBottom: 6,
		paddingLeft: 12,
		height: 60,
		width: 72,
		alignItems: 'flex-start',
		justifyContent: 'center',
	},
	pill: {
		position: 'absolute',
		left: 0,
		top: 10,
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
	tile: {
		width: 48,
		height: 48,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
	},
})
