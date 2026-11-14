import { getAssetIdByName } from '@valenced/assets'
import Page from '@valenced/components/Page'
import TableRowAssetIcon from '@valenced/components/TableRowAssetIcon'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { useState } from 'react'
import { Image, ScrollView, View } from 'react-native'
import {
	BRAND_COLOR,
	extractBaseColor,
	extractMemberRoleColor,
	getPerceivedLuminance,
	TAG_KEYS,
	TEXT_DARK,
	TEXT_LIGHT,
} from './lib/tags'
import type { DiscordModules } from '@valenced/discord/types'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings, TagCustomConfig } from './types'

const {
	Button,
	Card,
	Stack,
	TableRow,
	TableRowGroup,
	TableSwitchRow,
	Text,
	TextInput,
} = Design

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
	const [isTagModalOpen, setIsTagModalOpen] = useState(false)
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
	let previewRoleColor: string | undefined

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

		if (useRoleColor) {
			const selectedGuildStore = Stores?.SelectedGuildStore as
				| DiscordModules.Flux.Store<{
						getGuildId?: () => string | undefined
				  }>
				| undefined
			const currentGuildId = selectedGuildStore?.getGuildId?.()
			const currentUserId = currentUser?.id
			if (currentGuildId && currentUserId) {
				previewRoleColor = extractMemberRoleColor(currentGuildId, currentUserId)
			}
		}
	} catch {
		// safe fallback
	}

	const effectiveColor = currentCustomConfig?.color?.trim()
		? currentCustomConfig.color.trim()
		: useRoleColor && previewRoleColor
			? previewRoleColor
			: BRAND_COLOR

	const isGradient = effectiveColor.includes('gradient')
	const baseColor = extractBaseColor(effectiveColor)
	const previewTextColor =
		getPerceivedLuminance(baseColor) > 0.6 ? TEXT_DARK : TEXT_LIGHT
	const activeIcon = currentCustomConfig?.icon?.trim()

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

					{/* Tag Selector: Native TableRow that opens Tag selection sheet */}
					<TableRowGroup title="Tag Selection">
						<TableRow
							label="Tag to Configure"
							subLabel={`Currently selected: ${selectedTag}${currentCustomConfig ? ' • Customized' : ''}`}
							trailing={
								<Text variant="text-md/bold" color="text-brand">
									{selectedTag} ▾
								</Text>
							}
							onPress={() => setIsTagModalOpen(true)}
						/>
					</TableRowGroup>

					{/* Tag Live Preview Card */}
					<TableRowGroup title="Preview">
						<Card style={{ padding: 12 }}>
							<View
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									justifyContent: 'space-between',
								}}
							>
								<Text variant="text-xs/bold" color="text-muted">
									CHAT PREVIEW
								</Text>
								{currentCustomConfig?.color ? (
									<Text variant="text-xs/medium" color="text-warning">
										Custom color active
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
					</TableRowGroup>

					{/* Tag Customization Controls: All Native TableRow & TextInput */}
					<TableRowGroup title={`Tag Customization (${selectedTag})`}>
						<View
							style={{
								paddingHorizontal: 16,
								paddingTop: 12,
								paddingBottom: 8,
							}}
						>
							<TextInput
								label="Custom Display Name"
								placeholder={selectedTag}
								value={currentCustomConfig?.name ?? ''}
								onChange={(val: string) =>
									setCustomProperty(selectedTag, 'name', val)
								}
							/>
							{currentCustomConfig?.name ? (
								<View style={{ marginTop: 6, alignItems: 'flex-start' }}>
									<Button
										text="Reset Display Name"
										size="sm"
										variant="secondary"
										onPress={() =>
											setCustomProperty(selectedTag, 'name', undefined)
										}
									/>
								</View>
							) : null}
						</View>

						{/* Icon Row */}
						<TableRow
							label="Tag Icon / Emoji"
							subLabel={activeIcon || 'Default icon'}
							icon={
								ActiveIconComp ? (
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
									<Text style={{ fontSize: 20 }}>{activeIcon}</Text>
								) : (
									<TableRowAssetIcon name="ReactionIcon" />
								)
							}
							trailing={
								activeIcon ? (
									<Button
										text="Clear"
										size="sm"
										variant="secondary"
										onPress={() =>
											setCustomProperty(selectedTag, 'icon', undefined)
										}
									/>
								) : (
									<TableRowAssetIcon name="ChevronLargeRightIcon" />
								)
							}
							onPress={() => setIsIconModalOpen(true)}
						/>

						{/* Color Row */}
						<TableRow
							label="Tag Color"
							subLabel={currentCustomConfig?.color || 'Default brand color'}
							icon={
								<View
									style={{
										width: 24,
										height: 24,
										borderRadius: 12,
										backgroundColor: baseColor,
										borderWidth: 2,
										borderColor: 'rgba(255, 255, 255, 0.4)',
										...(isGradient
											? { experimental_backgroundImage: effectiveColor }
											: {}),
									}}
								/>
							}
							trailing={
								currentCustomConfig?.color ? (
									<Button
										text="Reset Color"
										size="sm"
										variant="secondary"
										onPress={() =>
											setCustomProperty(selectedTag, 'color', undefined)
										}
									/>
								) : (
									<TableRowAssetIcon name="ChevronLargeRightIcon" />
								)
							}
							onPress={() => setIsColorModalOpen(true)}
						/>
					</TableRowGroup>

					{/* Reset All for Selected Tag */}
					{currentCustomConfig &&
					Object.keys(currentCustomConfig).length > 0 ? (
						<View style={{ paddingHorizontal: 16 }}>
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

			{/* Tag Picker Bottom Sheet */}
			{PipModal ? (
				<PipModal
					visible={isTagModalOpen}
					onClose={() => setIsTagModalOpen(false)}
					title="Select Tag to Configure"
					subtitle="Choose which staff role tag to customize"
				>
					<TableRowGroup title="Available Tags">
						{TAG_KEYS.map(key => {
							const hasCustom =
								settings?.customTags?.[key] &&
								Object.keys(settings.customTags[key] ?? {}).length > 0
							return (
								<TableRow
									key={key}
									label={key}
									subLabel={
										settings?.customTags?.[key]?.name
											? `Custom name: ${settings.customTags[key].name}`
											: hasCustom
												? 'Has custom styling'
												: 'Default tag'
									}
									onPress={() => {
										setSelectedTag(key)
										setIsTagModalOpen(false)
									}}
									trailing={
										selectedTag === key ? (
											<TableRowAssetIcon name="CheckmarkLargeIcon" />
										) : undefined
									}
								/>
							)
						})}
					</TableRowGroup>
				</PipModal>
			) : null}

			{/* Dedicated Color Picker Modal */}
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

			{/* Icon & Emoji Selection Modal */}
			{PipModal && EmojiPicker ? (
				<PipModal
					visible={isIconModalOpen}
					onClose={() => setIsIconModalOpen(false)}
					title="Select Icon or Emoji"
					subtitle={`Browse emojis and Discord icons for ${selectedTag}`}
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
