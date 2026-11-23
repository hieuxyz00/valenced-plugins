import { Page } from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { refreshSettings } from '@valenced/discord/modules/settings'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSharedThemeTokens } from '../../../shared/theme'
import {
	fetchDiscoveryCategories,
	getCachedDiscoveryCategories,
} from './api/discoveryApi'
import { DefaultSettings } from './types'
import {
	filterDiscordTokens,
	resolveCustomTokenOrColor,
	setThemeOverrides,
} from './utils/theme'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { DiscoveryCategory, Settings } from './types'

type SettingsProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: Settings }>
>

const {
	Button,
	TableRadioGroup,
	TableRadioRow,
	TableRowGroup,
	TableSwitchRow,
	Text,
	TextInput,
} = Design

export default function SettingsComponent({ api }: SettingsProps) {
	const storage = api.jsonStorage
	const cached = storage.use()
	const themeTokens = useSharedThemeTokens()

	const cardBorder = themeTokens.cardBorder
	const bgSecondary = themeTokens.bgSecondary
	const bgModifierAccent = themeTokens.bgModifierAccent
	const bgModifierSelected = themeTokens.bgModifierSelected
	const brandText = themeTokens.brand

	const [settings, setSettings] = useState<Settings>(() => {
		return {
			...DefaultSettings,
			...(cached as Partial<Settings> | undefined),
		}
	})

	const [categories, setCategories] = useState<DiscoveryCategory[]>(() => {
		const initCats = getCachedDiscoveryCategories()
		return initCats ? initCats.filter(c => Boolean(c.is_primary)) : []
	})

	const [customFieldKey, setCustomFieldKey] = useState('')
	const [customTokenValue, setCustomTokenValue] = useState('')
	const [searchQuery, setSearchQuery] = useState('')

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

	const themeOverrides = settings.themeOverrides ?? {}

	const updateSettings = (updates: Partial<Settings>) => {
		const next = { ...settings, ...updates }
		setSettings(next)
		if (storage) {
			storage.cache = next
			if (typeof storage.set === 'function') {
				void storage.set(next)
			}
		}
		if (updates.themeOverrides) {
			setThemeOverrides(updates.themeOverrides)
		}
		if ('enableSettingsItem' in updates || 'enableSettingsEntry' in updates) {
			try {
				refreshSettings()
			} catch {}
		}
	}

	const handleAddOverride = (key: string, value: string) => {
		const cleanKey = key.trim()
		const cleanVal = value.trim()
		if (!cleanKey || !cleanVal) return

		const nextOverrides = {
			...themeOverrides,
			[cleanKey]: cleanVal,
		}
		updateSettings({ themeOverrides: nextOverrides })
		setCustomFieldKey('')
		setCustomTokenValue('')
		setSearchQuery('')
	}

	const handleRemoveOverride = (key: string) => {
		const nextOverrides = { ...themeOverrides }
		delete nextOverrides[key]
		updateSettings({ themeOverrides: nextOverrides })
	}

	const tokenSuggestions = filterDiscordTokens(searchQuery, 6)

	const presetFields = [
		{ key: 'statusOnline', label: 'Online Dot', defaultVal: 'STATUS_ONLINE' },
		{
			key: 'cardPrimaryBg',
			label: 'Card Background',
			defaultVal: 'CARD_PRIMARY_BG',
		},
		{
			key: 'backgroundSecondary',
			label: 'Rail Item Bg',
			defaultVal: 'BACKGROUND_SECONDARY',
		},
		{
			key: 'statusPositive',
			label: 'Active Tint',
			defaultVal: 'STATUS_POSITIVE',
		},
	]

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
							subLabel="Display the compass icon at the bottom of the server list."
							value={settings.enableServerListItem}
							onValueChange={val =>
								updateSettings({ enableServerListItem: val })
							}
						/>
						<TableSwitchRow
							label="Show in Discord Settings"
							subLabel="Add Server Discovery directly inside Discord user settings."
							value={
								settings.enableSettingsItem ??
								settings.enableSettingsEntry ??
								true
							}
							onValueChange={val => {
								updateSettings({
									enableSettingsItem: val,
									enableSettingsEntry: val,
								})
							}}
						/>
					</TableRowGroup>

					<TableRowGroup title="Theme Token Overrides">
						<View style={styles.overrideBlock}>
							<Text
								variant="text-sm/normal"
								style={{ color: themeTokens.textMuted }}
							>
								Override any theme field with authentic Discord Semantic / Raw
								tokens or hex colors.
							</Text>

							<View style={styles.presetsRow}>
								{presetFields.map(p => {
									const isSet = Boolean(themeOverrides[p.key])
									return (
										<Pressable
											key={p.key}
											onPress={() => {
												setCustomFieldKey(p.key)
												setCustomTokenValue(p.defaultVal)
											}}
											style={[
												styles.presetChip,
												{
													backgroundColor: isSet
														? bgModifierSelected
														: bgModifierAccent,
													borderColor: isSet ? brandText : cardBorder,
													borderWidth: StyleSheet.hairlineWidth,
												},
											]}
										>
											<Text
												variant="text-xs/medium"
												style={{
													color: isSet
														? themeTokens.brand
														: themeTokens.textNormal,
													fontWeight: isSet ? '700' : '500',
												}}
											>
												{p.label}
											</Text>
										</Pressable>
									)
								})}
							</View>

							<View style={styles.inputsRow}>
								<TextInput
									placeholder="Field name (e.g. statusOnline)"
									value={customFieldKey}
									onChange={setCustomFieldKey}
									style={styles.fieldInput}
								/>
								<TextInput
									placeholder="Token / Hex (e.g. STATUS_ONLINE)"
									value={customTokenValue}
									onChange={(v: string) => {
										setCustomTokenValue(v)
										setSearchQuery(v)
									}}
									style={styles.tokenInput}
								/>
							</View>

							{tokenSuggestions.length > 0 && searchQuery ? (
								<View
									style={[
										styles.suggestionsContainer,
										{
											backgroundColor: bgSecondary,
											borderColor: cardBorder,
										},
									]}
								>
									{tokenSuggestions.map(item => (
										<Pressable
											key={item.name}
											onPress={() => {
												setCustomTokenValue(item.name)
												setSearchQuery('')
											}}
											style={styles.suggestionRow}
										>
											<View
												style={[
													styles.colorPreview,
													{
														backgroundColor: item.hex,
														borderColor: cardBorder,
													},
												]}
											/>
											<Text
												variant="text-xs/normal"
												style={{ color: themeTokens.textNormal }}
											>
												{item.name}
											</Text>
										</Pressable>
									))}
								</View>
							) : null}

							<Button
								size="sm"
								variant="secondary"
								text="Add / Update Override"
								disabled={!customFieldKey.trim() || !customTokenValue.trim()}
								onPress={() =>
									handleAddOverride(customFieldKey, customTokenValue)
								}
							/>
						</View>
					</TableRowGroup>

					<TableRowGroup title="Active Overrides">
						<View style={styles.overrideBlock}>
							{Object.keys(themeOverrides).length === 0 ? (
								<Text
									variant="text-sm/normal"
									style={{ color: themeTokens.textMuted }}
								>
									No active overrides. Default authentic theme tokens are in
									effect.
								</Text>
							) : (
								Object.entries(themeOverrides).map(([field, tokenVal]) => {
									const resolvedColor = resolveCustomTokenOrColor(
										tokenVal,
										themeTokens.textMuted,
									)
									return (
										<View
											key={field}
											style={[
												styles.activeRow,
												{ borderBottomColor: cardBorder },
											]}
										>
											<View
												style={[
													styles.colorPreview,
													{
														backgroundColor: resolvedColor,
														borderColor: cardBorder,
													},
												]}
											/>
											<View style={styles.activeDetails}>
												<Text
													variant="text-sm/medium"
													style={{ color: themeTokens.textNormal }}
												>
													{field}
												</Text>
												<Text
													variant="text-xs/normal"
													style={{ color: themeTokens.textMuted }}
												>
													{tokenVal} ({resolvedColor})
												</Text>
											</View>
											<Pressable
												onPress={() => handleRemoveOverride(field)}
												hitSlop={8}
											>
												<Text
													variant="text-sm/semibold"
													style={{ color: themeTokens.textDanger }}
												>
													Remove
												</Text>
											</Pressable>
										</View>
									)
								})
							)}
						</View>
					</TableRowGroup>

					{categories.length > 0 ? (
						<TableRowGroup title="Default Category">
							<TableRadioGroup<number>
								value={settings.defaultCategory}
								onChange={val => {
									updateSettings({ defaultCategory: val })
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
	overrideBlock: {
		padding: 16,
		gap: 12,
	},
	presetsRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	presetChip: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 12,
	},
	inputsRow: {
		gap: 8,
	},
	fieldInput: {
		width: '100%',
	},
	tokenInput: {
		width: '100%',
	},
	suggestionsContainer: {
		borderRadius: 8,
		padding: 8,
		gap: 6,
		borderWidth: StyleSheet.hairlineWidth,
	},
	suggestionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingVertical: 4,
	},
	colorPreview: {
		width: 14,
		height: 14,
		borderRadius: 7,
		borderWidth: 1,
	},
	activeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 8,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	activeDetails: {
		flex: 1,
	},
})
