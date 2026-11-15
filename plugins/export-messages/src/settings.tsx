import Page from '@valenced/components/Page'
import TableRowAssetIcon from '@valenced/components/TableRowAssetIcon'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { ScrollView, View } from 'react-native'
import { openExportModal } from './components/ExportModal'
import { DefaultSettings } from './types'
import { isSafSupported } from './utils/exporter'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { ExportDestination, ExportFormat, Settings } from './types'

const {
	TableRadioGroup,
	TableRadioRow,
	TableRow,
	TableRowGroup,
	TableSwitchRow,
} = Design

type SettingsProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: Settings }>
>

interface SelectedChannelStoreInstance {
	getChannelId?: () => string | undefined
}

export default function SettingsComponent({ api }: SettingsProps) {
	const storage = api.jsonStorage
	const cached = storage.use()
	const hasSaf = isSafSupported()

	const currentSettings: Settings = {
		...DefaultSettings,
		destination: hasSaf ? 'saf' : 'share',
		...(cached as Partial<Settings> | undefined),
	}

	return (
		<Page>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<View style={{ gap: 8 }}>
					<TableRowGroup title="Quick Actions">
						<TableRow
							label="Export Active Channel..."
							subLabel="Open export dialog to customize format, count, file name, and destination for current channel."
							trailing={<TableRowAssetIcon name="ChatIcon" />}
							onPress={() => {
								const selStore = Stores.SelectedChannelStore as unknown as
									| SelectedChannelStoreInstance
									| undefined
								const activeChannelId = selStore?.getChannelId?.()
								openExportModal({
									alertKey: 'valenced-settings-export-dialog',
									initialChannelId: activeChannelId,
									settings: currentSettings,
								})
							}}
						/>
					</TableRowGroup>

					<TableRadioGroup
						title="Default Export Format"
						value={currentSettings.format}
						onChange={(val: ExportFormat) => {
							void storage.set({ format: val })
						}}
					>
						<TableRadioRow
							label="Discord HTML (Recommended)"
							subLabel="Standalone offline chat viewer with avatars, markdown, attachments, and live search."
							value="html"
						/>
						<TableRadioRow
							label="Structured JSON"
							subLabel="Machine-readable JSON data with complete message objects."
							value="json"
						/>
						<TableRadioRow
							label="Plain Text"
							subLabel="Simple formatted text transcript."
							value="text"
						/>
					</TableRadioGroup>

					<TableRadioGroup
						title="Default Destination"
						value={
							!hasSaf && currentSettings.destination === 'saf'
								? 'share'
								: currentSettings.destination
						}
						onChange={(val: ExportDestination) => {
							void storage.set({ destination: val })
						}}
					>
						{hasSaf && (
							<TableRadioRow
								label="Save to Device (SAF)"
								subLabel="Opens Android document picker to choose folder and custom file name (requires Hieuxyz Lib)."
								value="saf"
							/>
						)}
						<TableRadioRow
							label="System Share Sheet"
							subLabel="Share to other apps (Drive, Telegram, file managers, etc.)."
							value="share"
						/>
						<TableRadioRow
							label="Copy to Clipboard"
							subLabel="Directly copies exported content to your clipboard."
							value="clipboard"
						/>
					</TableRadioGroup>

					<TableRowGroup title="Content Options">
						<TableSwitchRow
							label="Include Timestamps"
							subLabel="Include message creation timestamps."
							value={currentSettings.includeTimestamps}
							onValueChange={(val: boolean) => {
								void storage.set({ includeTimestamps: val })
							}}
						/>
						<TableSwitchRow
							label="Include Attachments"
							subLabel="Render image, video, audio, and file attachment cards."
							value={currentSettings.includeAttachments}
							onValueChange={(val: boolean) => {
								void storage.set({ includeAttachments: val })
							}}
						/>
						<TableSwitchRow
							label="Include Embeds"
							subLabel="Render rich embeds with titles, descriptions, and fields."
							value={currentSettings.includeEmbeds}
							onValueChange={(val: boolean) => {
								void storage.set({ includeEmbeds: val })
							}}
						/>
					</TableRowGroup>
				</View>
			</ScrollView>
		</Page>
	)
}
