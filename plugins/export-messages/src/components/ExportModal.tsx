import { AlertActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import {
	exportChannelHistory,
	exportRangedHistory,
	exportSingleMessage,
	getLoadedChannelMessages,
	isSafSupported,
} from '../utils/exporter'
import type {
	DiscordMessage,
	ExportDestination,
	ExportFormat,
	ExportScope,
	Settings,
} from '../types'

const {
	AlertActionButton,
	AlertModal,
	TableRadioGroup,
	TableRadioRow,
	TableRowGroup,
	TableSwitchRow,
	TextInput,
} = Design

interface ExportModalProps {
	alertKey: string
	initialMessage?: DiscordMessage
	initialChannelId?: string
	settings: Settings
}

export function openExportModal({
	alertKey = 'valenced-export-dialog',
	initialMessage,
	initialChannelId,
	settings,
}: ExportModalProps): void {
	AlertActionCreators.openAlert(
		alertKey,
		<ExportDialogContent
			alertKey={alertKey}
			initialMessage={initialMessage}
			initialChannelId={initialChannelId}
			settings={settings}
		/>,
	)
}

function ExportDialogContent({
	alertKey,
	initialMessage,
	initialChannelId,
	settings,
}: ExportModalProps) {
	const hasSaf = isSafSupported()

	const [scope, setScope] = useState<ExportScope>(
		initialMessage ? 'message' : 'channel',
	)
	const [format, setFormat] = useState<ExportFormat>(settings.format ?? 'html')
	const [destination, setDestination] = useState<ExportDestination>(
		hasSaf ? (settings.destination ?? 'saf') : 'share',
	)

	const { messages: loadedMsgs, channelName } = getLoadedChannelMessages(
		initialChannelId ?? initialMessage?.channel_id,
	)
	const cleanName = channelName.replace(/[^a-zA-Z0-9_-]/g, '_')

	const [limitStr, setLimitStr] = useState<string>('all')

	const defaultExt =
		format === 'html' ? 'html' : format === 'json' ? 'json' : 'txt'
	const defaultBaseName =
		scope === 'message'
			? `discord_msg_${initialMessage?.id ?? Date.now()}`
			: scope === 'before'
				? `discord_${cleanName}_before_${initialMessage?.id ?? Date.now()}`
				: scope === 'after'
					? `discord_${cleanName}_after_${initialMessage?.id ?? Date.now()}`
					: `discord_${cleanName}_${Date.now()}`

	const [customFileName, setCustomFileName] = useState<string>(
		`${defaultBaseName}.${defaultExt}`,
	)

	const handleFormatChange = (newFormat: ExportFormat) => {
		setFormat(newFormat)
		const newExt =
			newFormat === 'html' ? 'html' : newFormat === 'json' ? 'json' : 'txt'
		setCustomFileName(prev => {
			const dotIdx = prev.lastIndexOf('.')
			if (dotIdx !== -1) {
				return `${prev.slice(0, dotIdx)}.${newExt}`
			}
			return `${prev}.${newExt}`
		})
	}

	const handleExport = () => {
		AlertActionCreators.dismissAlert(alertKey)

		const activeSettings: Settings = {
			...settings,
			format,
			destination,
		}

		if (scope === 'message' && initialMessage) {
			void exportSingleMessage(
				initialMessage,
				activeSettings,
				destination,
				customFileName,
			)
			return
		}

		const parsedLimit =
			limitStr === 'all'
				? 'all'
				: Math.max(1, Number.parseInt(limitStr, 10) || loadedMsgs.length)

		if ((scope === 'before' || scope === 'after') && initialMessage) {
			void exportRangedHistory(
				initialChannelId ?? initialMessage.channel_id,
				initialMessage,
				scope,
				parsedLimit,
				activeSettings,
				destination,
				customFileName,
			)
			return
		}

		void exportChannelHistory(
			initialChannelId ?? initialMessage?.channel_id,
			parsedLimit,
			activeSettings,
			destination,
			customFileName,
		)
	}

	return (
		<AlertModal
			title="Export Chat"
			content="Customize your export options below:"
			extraContent={
				<ScrollView
					style={{ maxHeight: 380 }}
					showsVerticalScrollIndicator={false}
				>
					<View style={{ gap: 12, paddingVertical: 4 }}>
						{initialMessage && (
							<TableRadioGroup
								title="Export Target"
								value={scope}
								onChange={(val: ExportScope) => {
									setScope(val)
									let base = `discord_${cleanName}_${Date.now()}`
									if (val === 'message') {
										base = `discord_msg_${initialMessage.id}`
									} else if (val === 'before') {
										base = `discord_${cleanName}_before_${initialMessage.id}`
									} else if (val === 'after') {
										base = `discord_${cleanName}_after_${initialMessage.id}`
									}
									setCustomFileName(`${base}.${defaultExt}`)
								}}
							>
								<TableRadioRow
									label="This Message Only"
									subLabel="Export only the selected message."
									value="message"
								/>
								<TableRadioRow
									label="From Selected Message Backwards"
									subLabel="Export from this message back into older history."
									value="before"
								/>
								<TableRadioRow
									label="From Selected Message Forwards"
									subLabel="Export from this message forward into newer history."
									value="after"
								/>
								<TableRadioRow
									label="Channel Chat History"
									subLabel={`Export history from #${channelName} (${loadedMsgs.length} messages loaded).`}
									value="channel"
								/>
							</TableRadioGroup>
						)}

						{scope !== 'message' && (
							<TableRowGroup title="Message Count">
								<TableSwitchRow
									label={
										scope === 'before'
											? 'Export All Older Messages'
											: scope === 'after'
												? 'Export All Newer Messages'
												: 'Export All Loaded Messages'
									}
									subLabel={
										scope === 'before'
											? 'Exports all available messages before this message.'
											: scope === 'after'
												? 'Exports all available messages after this message.'
												: `Exports all ${loadedMsgs.length} currently loaded messages.`
									}
									value={limitStr === 'all'}
									onValueChange={(val: boolean) => {
										setLimitStr(val ? 'all' : '50')
									}}
								/>
								{limitStr !== 'all' && (
									<View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
										<TextInput
											label="Target Message Count"
											placeholder="e.g. 50, 100, 200 (fetches more if needed)"
											value={limitStr}
											onChange={(text: string) => {
												setLimitStr(text.replace(/[^0-9]/g, ''))
											}}
										/>
									</View>
								)}
							</TableRowGroup>
						)}

						<TableRadioGroup
							title="Export Format"
							value={format}
							onChange={handleFormatChange}
						>
							<TableRadioRow
								label="Discord HTML (Recommended)"
								subLabel="Standalone offline chat viewer with avatars, markdown, attachments, and search."
								value="html"
							/>
							<TableRadioRow
								label="JSON"
								subLabel="Structured data with raw message objects."
								value="json"
							/>
							<TableRadioRow
								label="Plain Text"
								subLabel="Simple formatted text transcript."
								value="text"
							/>
						</TableRadioGroup>

						<TableRadioGroup
							title="Save Destination"
							value={destination}
							onChange={(val: ExportDestination) => setDestination(val)}
						>
							{hasSaf && (
								<TableRadioRow
									label="Save to Device (SAF)"
									subLabel="Opens Android document picker to choose folder and custom file name."
									value="saf"
								/>
							)}
							<TableRadioRow
								label="System Share Sheet"
								subLabel="Share to other apps (Drive, Telegram, etc.)."
								value="share"
							/>
							<TableRadioRow
								label="Copy to Clipboard"
								subLabel="Copies output directly to clipboard."
								value="clipboard"
							/>
						</TableRadioGroup>

						<TableRowGroup title="File Name">
							<View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
								<TextInput
									label="Output File Name"
									placeholder="e.g. discord_chat.html"
									value={customFileName}
									onChange={(text: string) => setCustomFileName(text)}
								/>
							</View>
						</TableRowGroup>
					</View>
				</ScrollView>
			}
			actions={
				<>
					<AlertActionButton
						text="Export"
						variant="primary"
						onPress={handleExport}
					/>
					<AlertActionButton
						text="Cancel"
						onPress={() => AlertActionCreators.dismissAlert(alertKey)}
					/>
				</>
			}
		/>
	)
}
