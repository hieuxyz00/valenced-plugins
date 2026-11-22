import { Page } from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { refreshSettings } from '@valenced/discord/modules/settings'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	fetchDiscoveryCategories,
	getCachedDiscoveryCategories,
} from './api/discoveryApi'
import { DefaultSettings } from './types'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { DiscoveryCategory, Settings } from './types'

type SettingsProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: Settings }>
>

export default function SettingsComponent({ api }: SettingsProps) {
	const { TableRadioGroup, TableRadioRow, TableRowGroup, TableSwitchRow } =
		Design

	const storage = api.jsonStorage
	const cached = storage.use()
	const settings: Settings = {
		...DefaultSettings,
		...(cached as Partial<Settings> | undefined),
	}

	const [categories, setCategories] = useState<DiscoveryCategory[]>(() => {
		const initCats = getCachedDiscoveryCategories()
		return initCats ? initCats.filter(c => Boolean(c.is_primary)) : []
	})

	useEffect(() => {
		let isMounted = true
		void fetchDiscoveryCategories().then(cats => {
			if (isMounted && cats && cats.length > 0) {
				setCategories(cats.filter(c => Boolean(c.is_primary)))
			}
		})
		return () => {
			isMounted = false
		}
	}, [])

	return (
		<Page>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.scroll}
				nestedScrollEnabled={true}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.container}>
					<TableRowGroup title="Access & Navigation">
						<TableSwitchRow
							label="Show in Server List"
							subLabel="Display a Compass icon entrypoint at the end of the server list, matching Discord Desktop."
							value={settings.enableServerListItem}
							onValueChange={val => {
								void storage.set({ enableServerListItem: val })
							}}
						/>
						<TableSwitchRow
							label="Show in Discord Settings"
							subLabel="Add Server Discovery directly inside Discord user settings."
							value={settings.enableSettingsItem}
							onValueChange={val => {
								void storage.set({ enableSettingsItem: val })
								try {
									refreshSettings()
								} catch {}
							}}
						/>
					</TableRowGroup>

					{categories.length > 0 ? (
						<TableRowGroup title="Default Category">
							<TableRadioGroup<number>
								value={settings.defaultCategory}
								onChange={val => {
									void storage.set({ defaultCategory: val })
								}}
							>
								{categories.map(cat => (
									<TableRadioRow
										key={`def-cat-${cat.id}`}
										label={cat.name}
										value={cat.id}
									/>
								))}
							</TableRadioGroup>
						</TableRowGroup>
					) : null}
				</View>
			</ScrollView>
		</Page>
	)
}

const styles = StyleSheet.create({
	scroll: {
		paddingBottom: 32,
	},
	container: {
		paddingHorizontal: 16,
		paddingTop: 16,
		gap: 16,
	},
})
