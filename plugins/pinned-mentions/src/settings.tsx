import Page from '@valenced/components/Page'
import TableRowAssetIcon from '@valenced/components/TableRowAssetIcon'
import { AlertActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { useState } from 'react'
import { Image, ScrollView, View } from 'react-native'
import { useSharedThemeTokens } from '../../../shared/theme'
import { DefaultSettings } from './types'
import {
	addPinnedUsers,
	clearServerPins,
	getActiveGuild,
	getActiveScopeId,
	getPinnedUserIds,
	getUserAvatarUrl,
	removePinnedUser,
} from './utils/storage'
import { setToastContext, showToast } from './utils/toast'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { MentionQueryItemUser, Settings } from './types'

interface UserStoreType {
	getUser?: (id: string) => MentionQueryItemUser | undefined
}

interface GuildStoreType {
	getGuild?: (
		id: string,
	) => { id?: string; name?: string; icon?: string } | undefined
}

type SettingsProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: Settings }>
>

const CLEAR_ALERT_KEY = 'pinned-mentions-clear-confirm'

export default function SettingsComponent({ api }: SettingsProps) {
	setToastContext({ plugin: api.plugin, unscoped: api.unscoped })

	const {
		AlertActionButton,
		AlertModal,
		Button,
		TableRadioGroup,
		TableRadioRow,
		TableRow,
		TableRowGroup,
		TableSwitchRow,
		Text,
		TextInput,
	} = Design

	const storage = api.jsonStorage
	const cached = storage.use()
	const themeTokens = useSharedThemeTokens()
	const settings = {
		...DefaultSettings,
		...(cached as Partial<Settings> | undefined),
	}

	const [idInput, setIdInput] = useState('')
	const [activeScope, setActiveScope] = useState<string>(() =>
		getActiveScopeId(),
	)

	const activeGuild = getActiveGuild()
	const userStore = Stores?.UserStore as UserStoreType | undefined
	const guildStore = Stores?.GuildStore as GuildStoreType | undefined

	let currentScopeName = 'Global / Direct Messages'
	if (activeScope !== 'global') {
		const server = guildStore?.getGuild?.(activeScope)
		if (server?.name) {
			currentScopeName = server.name
		} else if (activeGuild?.id === activeScope && activeGuild?.name) {
			currentScopeName = activeGuild.name
		} else {
			currentScopeName = `Server (${activeScope})`
		}
	}

	const pinnedIds = getPinnedUserIds(settings, activeScope)

	const handleAddUserIds = async () => {
		const raw = idInput.trim()
		if (!raw) return

		const tokens = raw.split(/[\s,]+/).filter(Boolean)
		const validIds = Array.from(
			new Set(tokens.filter(t => /^\d{17,20}$/.test(t))),
		)

		if (validIds.length === 0) {
			showToast({
				content: 'No valid Discord User ID found (must be 17-20 digits)',
				variant: 'warning',
			})
			return
		}

		const usersToPin = validIds.map(userId => {
			const fetchedUser = userStore?.getUser?.(userId)
			return {
				id: userId,
				info: {
					username: fetchedUser?.username,
					globalName: fetchedUser?.globalName,
					avatar: fetchedUser?.avatar,
				},
			}
		})

		const addedCount = await addPinnedUsers(storage, activeScope, usersToPin)
		setIdInput('')
		showToast({
			content: `Successfully pinned ${addedCount} user${addedCount > 1 ? 's' : ''}!`,
			variant: 'success',
		})
	}

	const handleConfirmClear = () => {
		const actionButtons = [
			<AlertActionButton
				key="clear"
				text="Clear All"
				variant="destructive"
				onPress={() => {
					AlertActionCreators.dismissAlert(CLEAR_ALERT_KEY)
					void clearServerPins(storage, activeScope).then(() => {
						showToast({
							content: `Cleared all pinned mentions for ${currentScopeName}`,
							variant: 'default',
						})
					})
				}}
			/>,
			<AlertActionButton
				key="cancel"
				text="Cancel"
				variant="secondary"
				onPress={() => AlertActionCreators.dismissAlert(CLEAR_ALERT_KEY)}
			/>,
		]

		AlertActionCreators.openAlert(
			CLEAR_ALERT_KEY,
			<AlertModal
				title="Clear Pinned Mentions"
				content={`Are you sure you want to unpin all ${pinnedIds.length} users for ${currentScopeName}?`}
				actions={actionButtons}
			/>,
		)
	}

	const otherServers = Object.keys(settings.serverPins || {}).filter(
		s => s !== activeScope && (settings.serverPins[s]?.length ?? 0) > 0,
	)

	return (
		<Page>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 40 }}
			>
				<View style={{ gap: 12 }}>
					<TableRowGroup title="General Settings">
						<TableSwitchRow
							label="Enable Pinned Mentions"
							subLabel="Pin frequently pinged users to the top of mention autocomplete."
							value={settings.enabled}
							onValueChange={val => {
								void storage.set({ ...settings, enabled: val }, true)
							}}
						/>
						<TableSwitchRow
							label="Show Pin Indicator"
							subLabel="Display a small pin icon badge on pinned users in autocomplete results."
							value={settings.showPinBadge}
							onValueChange={val => {
								void storage.set({ ...settings, showPinBadge: val }, true)
							}}
						/>
						<TableSwitchRow
							label="Always on Top"
							subLabel="Keep pinned users at the very top of mention suggestions regardless of your current query."
							value={settings.alwaysOnTop}
							onValueChange={val => {
								void storage.set({ ...settings, alwaysOnTop: val }, true)
							}}
						/>
						<TableSwitchRow
							label="Vibration Feedback"
							subLabel="Vibrate when pinning or unpinning a user via long-press."
							value={settings.enableVibration}
							onValueChange={val => {
								void storage.set({ ...settings, enableVibration: val }, true)
							}}
						/>
						<TableSwitchRow
							label="Disable in Direct Messages"
							subLabel="Do not alter mention suggestions in DMs or group DMs."
							value={settings.disableInDms}
							onValueChange={val => {
								void storage.set({ ...settings, disableInDms: val }, true)
							}}
						/>
					</TableRowGroup>

					<TableRadioGroup
						title="Long-Press Pin Target"
						value={settings.longPressTarget}
						onChange={(val: 'server' | 'global') => {
							void storage.set({ ...settings, longPressTarget: val }, true)
						}}
					>
						<TableRadioRow
							label="Current Server"
							subLabel="Pin to the current server mention suggestions"
							value="server"
						/>
						<TableRadioRow
							label="Global (All Servers & DMs)"
							subLabel="Pin globally across all servers and direct messages"
							value="global"
						/>
					</TableRadioGroup>

					<TableRowGroup title={`Current Scope: ${currentScopeName}`}>
						{activeScope !== 'global' && (
							<TableRow
								label="Switch to Global / DMs"
								subLabel="Manage pinned users applicable in direct messages and globally."
								icon={<TableRowAssetIcon name="GlobeEarthIcon" />}
								onPress={() => setActiveScope('global')}
							/>
						)}
						{activeGuild?.id && activeScope !== activeGuild.id && (
							<TableRow
								label={`Switch to ${activeGuild.name || 'Current Server'}`}
								subLabel="Manage pins for the active server."
								icon={<TableRowAssetIcon name="ServerIcon" />}
								onPress={() => setActiveScope(activeGuild.id)}
							/>
						)}
					</TableRowGroup>

					<TableRowGroup title={`Pinned Users (${pinnedIds.length})`}>
						{pinnedIds.length === 0 ? (
							<TableRow
								label="No users pinned yet"
								subLabel="Long-press any user in the @ mention list, use member info menu, or paste an ID below."
								icon={<TableRowAssetIcon name="PinIcon" />}
							/>
						) : (
							pinnedIds.map(userId => {
								const cachedRecord = settings.userCache?.[userId]
								const liveUser = userStore?.getUser?.(userId)
								const displayName =
									liveUser?.globalName ||
									cachedRecord?.globalName ||
									liveUser?.username ||
									cachedRecord?.username ||
									userId

								const subText =
									liveUser?.username && displayName !== liveUser.username
										? `@${liveUser.username} • ${userId}`
										: userId

								const avatarUrl = getUserAvatarUrl(
									liveUser,
									cachedRecord?.avatar,
									activeScope,
									32,
								)

								const leadingIcon = avatarUrl ? (
									<Image
										source={{ uri: avatarUrl }}
										style={{ width: 32, height: 32, borderRadius: 16 }}
									/>
								) : (
									<TableRowAssetIcon name="UserIcon" />
								)

								return (
									<TableRow
										key={userId}
										label={displayName}
										subLabel={subText}
										icon={leadingIcon}
										trailing={
											<Button
												text="Unpin"
												variant="destructive"
												size="sm"
												onPress={() => {
													void removePinnedUser(
														storage,
														activeScope,
														userId,
													).then(() => {
														showToast({
															content: `Unpinned @${displayName}`,
															variant: 'default',
														})
													})
												}}
											/>
										}
									/>
								)
							})
						)}
					</TableRowGroup>

					<TableRowGroup title="Add User by ID">
						<View
							style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}
						>
							<Text
								variant="text-sm/normal"
								style={{ color: themeTokens.textMuted }}
							>
								Paste one or more Discord user IDs to pin them to{' '}
								{currentScopeName}. Separate multiple IDs with commas or spaces.
							</Text>
							<TextInput
								value={idInput}
								onChange={setIdInput}
								placeholder="e.g. 123456789012345678, 234567890123456789"
								clearable={true}
								isClearable={true}
								onClear={() => setIdInput('')}
							/>
							<Button
								text="Pin User ID(s)"
								variant="primary"
								onPress={handleAddUserIds}
								disabled={!idInput.trim()}
							/>
						</View>
					</TableRowGroup>

					{pinnedIds.length > 0 && (
						<TableRowGroup title="Danger Zone">
							<View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
								<Button
									text={`Clear All Pins for ${currentScopeName}`}
									variant="destructive"
									onPress={handleConfirmClear}
								/>
							</View>
						</TableRowGroup>
					)}

					{otherServers.length > 0 && (
						<TableRowGroup title="Other Servers with Pinned Users">
							{otherServers.map(scopeKey => {
								const count = settings.serverPins[scopeKey]?.length ?? 0
								const serverObj = guildStore?.getGuild?.(scopeKey)
								const name = serverObj?.name || `Server (${scopeKey})`
								return (
									<TableRow
										key={scopeKey}
										label={name}
										subLabel={`${count} user${count > 1 ? 's' : ''} pinned`}
										icon={<TableRowAssetIcon name="ServerIcon" />}
										onPress={() => setActiveScope(scopeKey)}
									/>
								)
							})}
						</TableRowGroup>
					)}
				</View>
			</ScrollView>
		</Page>
	)
}
