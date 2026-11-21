import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { ScrollView, View } from 'react-native'
import { DefaultSettings } from './types'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings } from './types'

type SettingsProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: Settings }>
>

export default function SettingsComponent({ api }: SettingsProps) {
	const { TableRowGroup, TableSwitchRow } = Design
	const storage = api.jsonStorage
	const cached = storage.use()
	const settings = {
		...DefaultSettings,
		...(cached as Partial<Settings> | undefined),
	}

	return (
		<Page>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<View style={{ gap: 8 }}>
					<TableRowGroup title="Voice Features">
						<TableSwitchRow
							label="Voice Channel Status"
							subLabel="Allow setting, editing, and clearing status on voice channels."
							value={settings.enableVoiceStatus}
							onValueChange={val => {
								void storage.set({ enableVoiceStatus: val })
							}}
						/>
						<TableSwitchRow
							label="Bulk Voice Actions"
							subLabel="Add bulk moderation actions (disconnect, move, mute, deafen everyone) in long-press menu."
							value={settings.enableBulkActions}
							onValueChange={val => {
								void storage.set({ enableBulkActions: val })
							}}
						/>
					</TableRowGroup>

					<TableRowGroup title="Confirmation Dialogs">
						<TableSwitchRow
							label="Confirm Disconnect Everyone"
							subLabel="Show confirmation dialog before disconnecting all members."
							value={settings.confirmDisconnect}
							onValueChange={val => {
								void storage.set({ confirmDisconnect: val })
							}}
						/>
						<TableSwitchRow
							label="Confirm Move Everyone"
							subLabel="Show confirmation dialog before moving all members."
							value={settings.confirmMove}
							onValueChange={val => {
								void storage.set({ confirmMove: val })
							}}
						/>
					</TableRowGroup>
				</View>
			</ScrollView>
		</Page>
	)
}
