import { getAssetIdByName } from '@valenced/assets'
import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { useState } from 'react'
import { Image, Pressable, ScrollView, View } from 'react-native'
import {
	BRAND_COLOR,
	extractBaseColor,
	getPerceivedLuminance,
	TAG_KEYS,
	TEXT_DARK,
	TEXT_LIGHT,
} from './lib/tags'
import type { DiscordModules } from '@valenced/discord/types'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings, TagCustomConfig } from './types'

const { Button, Card, Stack, TableRowGroup, TableSwitchRow, Text, TextInput } =
	Design

type SettingsProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: Settings }>
>

export default function SettingsComponent({ api }: SettingsProps) {
	const storage = api.jsonStorage
	const hieuxyz = api.hieuxyz ?? api.unscoped?.hieuxyz
	const PipModal = hieuxyz?.PipModal
	const ColorPickerModal = hieuxyz?.ColorPickerModal
	const EmojiPicker = hieuxyz?.EmojiPicker

	const settings = storage.use()
	const [selectedTag, setSelectedTag] = useState<string>('OWNER')
	const [isColorModalOpen, setIsColorModalOpen] = useState(false)
	const [isIconModalOpen, setIsIconModalOpen] = useState(false)

	const useRoleColor = settings?.useRoleColor ?? false
	const currentCustomConfig = settings?.customTags?.[selectedTag]

	const setCustomProperty = (
		tagKey: string,
		prop: keyof TagCustomConfig,
		val: string | undefined,
	) => {
		const currentCustomTags: Record<string, TagCustomConfig> = {
			...(settings?.customTags ?? {}),
		}
		const existing = currentCustomTags[tagKey] ?? {}
		const trimmed = typeof val === 'string' ? val.trim() : undefined

		if (!trimmed) {
			const updated = { ...existing }
			delete updated[prop]
			if (Object.keys(updated).length === 0) {
				delete currentCustomTags[tagKey]
			} else {
				currentCustomTags[tagKey] = updated
			}
		} else {
			currentCustomTags[tagKey] = {
				...existing,
				[prop]: trimmed,
			}
		}

		void storage.set(
			{
				useRoleColor,
				customTags: currentCustomTags,
			},
			true,
		)
	}

	const resetTag = (tagKey: string) => {
		const currentCustomTags: Record<string, TagCustomConfig> = {
			...(settings?.customTags ?? {}),
		}
		delete currentCustomTags[tagKey]
		void storage.set(
			{
				useRoleColor,
				customTags: currentCustomTags,
			},
			true,
		)
	}

	const displayName = currentCustomConfig?.name?.trim()
		? currentCustomConfig.name.trim()
		: selectedTag

	const effectiveColor = currentCustomConfig?.color?.trim()
		? currentCustomConfig.color.trim()
		: BRAND_COLOR

	const isGradient = effectiveColor.includes('gradient')
	const baseColor = extractBaseColor(effectiveColor)
	const previewTextColor =
		getPerceivedLuminance(baseColor) > 0.6 ? TEXT_DARK : TEXT_LIGHT
	const activeIcon = currentCustomConfig?.icon?.trim()

	interface UserStoreType {
		getCurrentUser?: () => {
			id?: string
			username?: string
			globalName?: string
			avatar?: string
			getAvatarURL?: (guildId?: string, size?: number) => string
		}
	}
	let previewUserName = 'Username'
	let previewAvatarUri: string | undefined
	try {
		const userStore = Stores?.UserStore as
			| DiscordModules.Flux.Store<UserStoreType>
			| undefined
		const currentUser = userStore?.getCurrentUser?.()
		if (currentUser) {
			previewUserName =
				currentUser.globalName || currentUser.username || 'Username'
			previewAvatarUri =
				currentUser.getAvatarURL?.(undefined, 80) ||
				(currentUser.id && currentUser.avatar
					? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=80`
					: undefined)
		}
	} catch {
		// safe fallback
	}

	let ActiveIconComp: React.ComponentType<Record<string, unknown>> | undefined
	if (
		activeIcon &&
		(activeIcon.endsWith('Icon') || activeIcon.includes('Icon'))
	) {
		try {
			ActiveIconComp = lookupGeneratedIconComponent(activeIcon) as
				| React.ComponentType<Record<string, unknown>>
				| undefined
		} catch {
			// fallback
		}
	}
	const activeIconAssetId = activeIcon
		? getAssetIdByName(activeIcon)
		: undefined

	return (
		<Page>
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingBottom: 40 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={true}
			>
				<Stack spacing={16}>
					{/* General Settings */}
					<TableRowGroup title="General Settings">
						<TableSwitchRow
							label="Use top role color for tag backgrounds"
							subLabel="Lower priority than custom tag color"
							value={useRoleColor}
							onValueChange={(value: boolean) => {
								void storage.set(
									{
										useRoleColor: value,
										customTags: settings?.customTags ?? {},
									},
									true,
								)
							}}
						/>
					</TableRowGroup>

					{/* Tag Selector Chips */}
					<View>
						<Text
							variant="heading-sm/bold"
							color="header-primary"
							style={{ marginBottom: 8 }}
						>
							Select Tag ({selectedTag})
						</Text>
						<View
							style={{
								flexDirection: 'row',
								flexWrap: 'wrap',
								gap: 6,
							}}
						>
							{TAG_KEYS.map(key => {
								const isSelected = selectedTag === key
								const hasCustom =
									settings?.customTags?.[key] &&
									Object.keys(settings.customTags[key] ?? {}).length > 0
								return (
									<Pressable
										key={key}
										onPress={() => setSelectedTag(key)}
										style={{
											paddingHorizontal: 12,
											paddingVertical: 6,
											borderRadius: 16,
											backgroundColor: isSelected
												? '#5865F2'
												: hasCustom
													? 'rgba(88, 101, 242, 0.25)'
													: 'rgba(255, 255, 255, 0.08)',
											borderWidth: isSelected ? 2 : hasCustom ? 1 : 0,
											borderColor: isSelected ? '#FFFFFF' : '#5865F2',
										}}
									>
										<Text
											variant="text-xs/bold"
											style={{
												color: isSelected ? '#FFFFFF' : '#DBDEE1',
											}}
										>
											{key}
											{hasCustom && !isSelected ? ' •' : ''}
										</Text>
									</Pressable>
								)
							})}
						</View>
					</View>

					{/* Tag Live Preview Card with Real Current User Profile */}
					<Card style={{ padding: 12 }}>
						<View
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'space-between',
							}}
						>
							<Text variant="text-xs/bold" color="text-muted">
								PREVIEW
							</Text>
							{currentCustomConfig?.color ? (
								<Text variant="text-xs/medium" color="text-warning">
									Custom color active (overrides server role colors)
								</Text>
							) : null}
						</View>
						<View
							style={{
								marginTop: 10,
								flexDirection: 'row',
								alignItems: 'center',
							}}
						>
							{/* Current User Avatar */}
							{previewAvatarUri ? (
								<Image
									source={{ uri: previewAvatarUri }}
									style={{
										width: 36,
										height: 36,
										borderRadius: 18,
										marginRight: 10,
										backgroundColor: 'rgba(255, 255, 255, 0.1)',
									}}
								/>
							) : (
								<View
									style={{
										width: 36,
										height: 36,
										borderRadius: 18,
										marginRight: 10,
										backgroundColor: '#5865F2',
										justifyContent: 'center',
										alignItems: 'center',
									}}
								>
									<Text variant="text-sm/bold" style={{ color: '#FFFFFF' }}>
										{previewUserName.charAt(0).toUpperCase()}
									</Text>
								</View>
							)}

							<View style={{ flexDirection: 'row', alignItems: 'center' }}>
								<Text
									variant="text-md/bold"
									color="header-primary"
									style={{ marginRight: 8 }}
								>
									{previewUserName}
								</Text>
								<View
									style={[
										{
											flexDirection: 'row',
											alignItems: 'center',
											paddingHorizontal: 6,
											paddingVertical: 2,
											borderRadius: 4,
											backgroundColor: baseColor,
										},
										isGradient
											? { experimental_backgroundImage: effectiveColor }
											: null,
									]}
								>
									{ActiveIconComp ? (
										<ActiveIconComp
											size="xs"
											color={previewTextColor}
											style={{
												width: 12,
												height: 12,
												marginRight: 4,
											}}
										/>
									) : activeIconAssetId !== undefined ? (
										<Image
											source={activeIconAssetId}
											style={{
												width: 12,
												height: 12,
												marginRight: 4,
												tintColor: previewTextColor,
											}}
										/>
									) : activeIcon ? (
										<Text
											style={{
												fontSize: 11,
												marginRight: 4,
												color: previewTextColor,
											}}
										>
											{activeIcon}
										</Text>
									) : null}
									<Text
										style={{
											fontSize: 11,
											fontWeight: '700',
											color: previewTextColor,
											textTransform: 'uppercase',
										}}
									>
										{displayName}
									</Text>
								</View>
							</View>
						</View>
					</Card>

					{/* Tag Customization Controls: Name, Square Icon Button, Square Color Button */}
					<TableRowGroup title="Tag Settings">
						<View style={{ padding: 12 }}>
							<TextInput
								label="Display Name"
								placeholder={selectedTag}
								value={currentCustomConfig?.name ?? ''}
								onChange={(val: string) =>
									setCustomProperty(selectedTag, 'name', val)
								}
							/>
							{currentCustomConfig?.name ? (
								<View style={{ marginTop: 6, alignItems: 'flex-start' }}>
									<Button
										text="Reset to Default Name"
										size="sm"
										variant="secondary"
										onPress={() =>
											setCustomProperty(selectedTag, 'name', undefined)
										}
									/>
								</View>
							) : null}

							{/* Icon Row: Small square icon button + text input */}
							<View style={{ marginTop: 12 }}>
								<View
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										gap: 10,
									}}
								>
									{/* Small square button for Icon */}
									<Pressable
										onPress={() => setIsIconModalOpen(true)}
										style={{
											width: 44,
											height: 44,
											borderRadius: 8,
											backgroundColor: 'rgba(255, 255, 255, 0.1)',
											justifyContent: 'center',
											alignItems: 'center',
											borderWidth: 2,
											borderColor: 'rgba(255, 255, 255, 0.25)',
										}}
									>
										{ActiveIconComp ? (
											<ActiveIconComp
												size="sm"
												color="#FFFFFF"
												style={{ width: 22, height: 22 }}
											/>
										) : activeIconAssetId !== undefined ? (
											<Image
												source={activeIconAssetId}
												style={{
													width: 22,
													height: 22,
													tintColor: '#FFFFFF',
												}}
											/>
										) : activeIcon ? (
											<Text style={{ fontSize: 22 }}>{activeIcon}</Text>
										) : (
											<Text style={{ fontSize: 20 }}>🏷️</Text>
										)}
									</Pressable>

									<View style={{ flex: 1 }}>
										<TextInput
											label="Custom Asset Name or Emoji"
											placeholder="ShieldUserIcon or 👑"
											value={currentCustomConfig?.icon ?? ''}
											onChange={(val: string) =>
												setCustomProperty(selectedTag, 'icon', val)
											}
										/>
									</View>

									{activeIcon ? (
										<Button
											text="Clear Icon"
											size="sm"
											variant="destructive"
											onPress={() =>
												setCustomProperty(selectedTag, 'icon', undefined)
											}
										/>
									) : null}
								</View>
							</View>

							{/* Color Row: Small square color button + text input */}
							<View style={{ marginTop: 12 }}>
								<View
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										gap: 10,
									}}
								>
									{/* Small square button for Color */}
									<Pressable
										onPress={() => setIsColorModalOpen(true)}
										style={{
											width: 48,
											height: 48,
											borderRadius: 8,
											backgroundColor: baseColor,
											justifyContent: 'center',
											alignItems: 'center',
											borderWidth: 2,
											borderColor: 'rgba(255, 255, 255, 0.35)',
											...(isGradient
												? { experimental_backgroundImage: effectiveColor }
												: {}),
										}}
									>
										<View
											style={{
												width: 8,
												height: 8,
												borderRadius: 4,
												backgroundColor: previewTextColor,
											}}
										/>
									</Pressable>

									<View style={{ flex: 1 }}>
										<TextInput
											label="Custom Hex Color or CSS Gradient"
											placeholder="#5865F2 or linear-gradient(...)"
											value={currentCustomConfig?.color ?? ''}
											onChange={(val: string) =>
												setCustomProperty(selectedTag, 'color', val)
											}
										/>
									</View>

									{currentCustomConfig?.color ? (
										<Button
											text="Reset to Default Color"
											size="sm"
											variant="secondary"
											onPress={() =>
												setCustomProperty(selectedTag, 'color', undefined)
											}
										/>
									) : null}
								</View>
							</View>
						</View>
					</TableRowGroup>

					{/* Reset All for Selected Tag */}
					{currentCustomConfig &&
					Object.keys(currentCustomConfig).length > 0 ? (
						<View style={{ alignItems: 'flex-start', paddingTop: 8 }}>
							<Button
								text={`Reset All Customizations for ${selectedTag}`}
								size="sm"
								variant="destructive"
								onPress={() => resetTag(selectedTag)}
							/>
						</View>
					) : null}
				</Stack>
			</ScrollView>

			{/* Dedicated Floating PiP Color Palette Modal */}
			{ColorPickerModal ? (
				<ColorPickerModal
					visible={isColorModalOpen}
					onClose={() => setIsColorModalOpen(false)}
					title="Color Palette"
					subtitle={`Customize ${selectedTag} color`}
					initialColor={effectiveColor}
					allowGradient={true}
					onSelect={color => {
						setCustomProperty(selectedTag, 'color', color)
						setIsColorModalOpen(false)
					}}
					onReset={() => {
						setCustomProperty(selectedTag, 'color', undefined)
						setIsColorModalOpen(false)
					}}
				/>
			) : null}

			{/* Side/Bottom PiP Modal for Icon & Emoji Selection */}
			{PipModal && EmojiPicker ? (
				<PipModal
					visible={isIconModalOpen}
					onClose={() => setIsIconModalOpen(false)}
					title="Select Icon or Emoji"
					subtitle={`Browse emojis and Discord icons for ${selectedTag}`}
					height="78%"
					scrollable={false}
				>
					<EmojiPicker
						currentIcon={activeIcon}
						onSelect={icon => {
							setCustomProperty(selectedTag, 'icon', icon)
							setIsIconModalOpen(false)
						}}
					/>
				</PipModal>
			) : null}
		</Page>
	)
}
