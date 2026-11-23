import { TableRowAssetIcon } from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { useEffect } from 'react'
import * as ReactNative from 'react-native'
import { DiscoveryState } from '../state/discoveryState'
import { DefaultSettings } from '../types'
import { useSafeArea } from '../utils/safeArea'
import { ServerDiscoveryView } from './ServerDiscoveryView'
import type { JsonStorage } from '@valenced/json-storage'
import type { Settings } from '../types'

const { BackHandler, Pressable, StyleSheet, View } = ReactNative as unknown as {
	BackHandler?: {
		addEventListener: (evt: string, cb: () => boolean) => { remove: () => void }
	}
	Pressable: typeof ReactNative.Pressable
	StyleSheet: typeof ReactNative.StyleSheet
	View: typeof ReactNative.View
}

interface ServerDiscoveryTabProps {
	storage?: JsonStorage<Settings>
}

export function ServerDiscoveryTab({ storage }: ServerDiscoveryTabProps) {
	const { Text } = Design
	const insets = useSafeArea()
	const cached = storage?.use?.() ?? storage?.cache
	const settings = (cached as Settings | undefined) ?? DefaultSettings

	useEffect(() => {
		if (BackHandler?.addEventListener) {
			const handler = () => {
				if (DiscoveryState.isActive) {
					DiscoveryState.setActive(false)
					DiscoveryState.openDrawer()
					return true
				}
				return false
			}
			const subscription = BackHandler.addEventListener(
				'hardwareBackPress',
				handler,
			)
			return () => {
				subscription?.remove?.()
				;(
					BackHandler as unknown as {
						removeEventListener?: (evt: string, cb: () => boolean) => void
					}
				)?.removeEventListener?.('hardwareBackPress', handler)
			}
		}
	}, [])

	const handleCloseTab = () => {
		DiscoveryState.setActive(false)
		DiscoveryState.openDrawer()
	}

	return (
		<View
			style={[
				styles.tabContainer,
				{
					paddingTop: insets.top,
					paddingBottom: insets.bottom,
					paddingLeft: insets.left,
					paddingRight: insets.right,
				},
			]}
		>
			<View style={styles.header}>
				<Pressable
					accessibilityLabel="Back to Server List"
					accessibilityRole="button"
					onPress={handleCloseTab}
					style={styles.backButton}
					hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
				>
					<TableRowAssetIcon name="ArrowLargeLeftIcon" />
				</Pressable>
				<Text
					variant="heading-md/semibold"
					color="text-normal"
					style={styles.headerTitle}
				>
					Server Discovery
				</Text>
			</View>
			<ServerDiscoveryView
				isModal={false}
				onClose={handleCloseTab}
				settings={settings}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	tabContainer: {
		width: '100%',
		height: '100%',
		flex: 1,
		backgroundColor: '#313338',
	},
	header: {
		height: 48,
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(255, 255, 255, 0.08)',
	},
	backButton: {
		marginRight: 12,
		padding: 4,
		alignItems: 'center',
		justifyContent: 'center',
	},
	headerTitle: {
		fontSize: 18,
	},
})
