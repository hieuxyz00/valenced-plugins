import Page from '@valenced/components/Page'
import { AlertActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { getLanguageName, LANGUAGES } from './languages'
import { DefaultSettings } from './types'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings, TranslationProvider } from './types'

const {
	AlertActionButton,
	AlertModal,
	Stack,
	TableRadioGroup,
	TableRadioRow,
	TableRow,
	TableRowGroup,
	TableSwitchRow,
	TextArea,
} = Design

function openChannelInputAlert(
	mode: 'send' | 'rev',
	currentChannels: string[],
	onSave: (channels: string[]) => void,
) {
	const key = `translator-channels-${mode}`
	let buffer = currentChannels.join('\n')

	AlertActionCreators.openAlert(
		key,
		<AlertModal
			title={
				mode === 'send'
					? 'Send Auto-Translate Channels'
					: 'Receive Auto-Translate Channels'
			}
			content="Enter channel IDs separated by spaces, commas, or newlines:"
			extraContent={
				<TextArea
					defaultValue={buffer}
					placeholder="e.g. 112233445566 778899001122"
					onChange={val => {
						buffer = val
					}}
				/>
			}
			actions={
				<>
					<AlertActionButton
						text="Save"
						variant="primary"
						onPress={() => {
							const parsed = buffer
								.split(/[,\s\n]+/)
								.map(s => s.trim())
								.filter(s => s.length > 0 && /^\d+$/.test(s))
							onSave(Array.from(new Set(parsed)))
							AlertActionCreators.dismissAlert(key)
						}}
					/>
					<AlertActionButton
						text="Clear All"
						variant="destructive"
						onPress={() => {
							onSave([])
							AlertActionCreators.dismissAlert(key)
						}}
					/>
					<AlertActionButton
						text="Cancel"
						variant="secondary"
						onPress={() => AlertActionCreators.dismissAlert(key)}
					/>
				</>
			}
		/>,
	)
}

export default function SettingsComponent({
	api,
}: ComponentProps<PluginSettingsComponent<{ jsonStorage: Settings }>>) {
	const storage = api.jsonStorage
	const LanguagePickerModal = (api.hieuxyz ?? api.unscoped?.hieuxyz)
		?.LanguagePickerModal

	const stored = storage.use()
	const settings: Settings = { ...DefaultSettings, ...stored }

	const provider = settings.provider ?? DefaultSettings.provider
	const sourceLang = settings.sourceLang ?? DefaultSettings.sourceLang
	const targetLang = settings.targetLang ?? DefaultSettings.targetLang
	const sendSourceLang =
		settings.sendSourceLang ?? DefaultSettings.sendSourceLang
	const sendTargetLang =
		settings.sendTargetLang ?? DefaultSettings.sendTargetLang
	const autoTranslateSend =
		settings.autoTranslateSend ?? DefaultSettings.autoTranslateSend
	const autoTranslateRev =
		settings.autoTranslateRev ?? DefaultSettings.autoTranslateRev
	const chatButtonEnabled =
		settings.chatButtonEnabled ?? DefaultSettings.chatButtonEnabled
	const chatButtonPosition =
		settings.chatButtonPosition ?? DefaultSettings.chatButtonPosition

	const sendChannels = Array.isArray(settings.sendChannels)
		? settings.sendChannels
		: []
	const revChannels = Array.isArray(settings.revChannels)
		? settings.revChannels
		: []

	const [pickerMode, setPickerMode] = useState<
		'source' | 'target' | 'sendSource' | 'sendTarget' | null
	>(null)

	const currentPickerLang = () => {
		switch (pickerMode) {
			case 'source':
				return sourceLang
			case 'target':
				return targetLang
			case 'sendSource':
				return sendSourceLang
			case 'sendTarget':
				return sendTargetLang
			default:
				return 'en'
		}
	}

	const pickerTitle = () => {
		switch (pickerMode) {
			case 'source':
				return 'Select Receive Source Language'
			case 'target':
				return 'Select Receive Target Language'
			case 'sendSource':
				return 'Select Send Source Language'
			case 'sendTarget':
				return 'Select Send Target Language'
			default:
				return 'Select Language'
		}
	}

	return (
		<Page>
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingBottom: 40 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={true}
			>
				<Stack spacing={20}>
					<TableRadioGroup<TranslationProvider>
						title="Translation Service"
						value={provider}
						onChange={(selected: TranslationProvider) => {
							void storage.set({ provider: selected })
						}}
					>
						<TableRadioRow value="google" label="Google Translate (Free)" />
						<TableRadioRow value="microsoft" label="Microsoft Edge Direct" />
						<TableRadioRow value="mymemory" label="MyMemory (Free)" />
					</TableRadioGroup>

					<TableRowGroup title="Receive Languages (Incoming & Context Menu)">
						<TableRow
							label="Translate from"
							subLabel={getLanguageName(sourceLang)}
							onPress={() => setPickerMode('source')}
						/>
						<TableRow
							label="Translate to"
							subLabel={getLanguageName(targetLang)}
							onPress={() => setPickerMode('target')}
						/>
					</TableRowGroup>

					<TableRowGroup title="Send Languages (Outgoing Messages)">
						<TableRow
							label="Send from"
							subLabel={getLanguageName(sendSourceLang)}
							onPress={() => setPickerMode('sendSource')}
						/>
						<TableRow
							label="Send to"
							subLabel={getLanguageName(sendTargetLang)}
							onPress={() => setPickerMode('sendTarget')}
						/>
					</TableRowGroup>

					<TableRowGroup title="Auto-Translate Controls">
						<TableSwitchRow
							label="Auto-translate outgoing messages (Send)"
							subLabel="Translates text before sending in all channels"
							value={autoTranslateSend}
							onValueChange={(val: boolean) => {
								void storage.set({ autoTranslateSend: val })
							}}
						/>
						<TableSwitchRow
							label="Auto-translate incoming messages (Receive)"
							subLabel="Translates new messages in all channels"
							value={autoTranslateRev}
							onValueChange={(val: boolean) => {
								void storage.set({ autoTranslateRev: val })
							}}
						/>
					</TableRowGroup>

					<TableRowGroup title="Chat Input Bar Button">
						<TableSwitchRow
							label="Show Chat Bar Button"
							subLabel="Show quick-toggle translator icon in chat input bar"
							value={chatButtonEnabled}
							onValueChange={(val: boolean) => {
								void storage.set({ chatButtonEnabled: val })
							}}
						/>
						<TableRadioGroup<'left' | 'right'>
							title="Button Position"
							value={chatButtonPosition}
							onChange={(val: 'left' | 'right') => {
								void storage.set({ chatButtonPosition: val })
							}}
						>
							<TableRadioRow
								value="right"
								label="Right (before emoji / send button)"
							/>
							<TableRadioRow
								value="left"
								label="Left (after attachments button)"
							/>
						</TableRadioGroup>
					</TableRowGroup>

					<TableRowGroup title="Channel Configuration">
						<TableRow
							label="Send Auto-Translate Channels"
							subLabel={
								sendChannels.length > 0
									? `${sendChannels.length} channels configured (tap to edit/bulk paste IDs)`
									: 'None (tap to add or bulk paste channel IDs)'
							}
							onPress={() =>
								openChannelInputAlert('send', sendChannels, newChannels => {
									void storage.set({ sendChannels: newChannels })
								})
							}
						/>
						<TableRow
							label="Receive Auto-Translate Channels"
							subLabel={
								revChannels.length > 0
									? `${revChannels.length} channels configured (tap to edit/bulk paste IDs)`
									: 'None (tap to add or bulk paste channel IDs)'
							}
							onPress={() =>
								openChannelInputAlert('rev', revChannels, newChannels => {
									void storage.set({ revChannels: newChannels })
								})
							}
						/>
					</TableRowGroup>

					{LanguagePickerModal ? (
						<LanguagePickerModal
							visible={pickerMode !== null}
							title={pickerTitle()}
							current={currentPickerLang()}
							allowAuto={pickerMode === 'source' || pickerMode === 'sendSource'}
							languages={LANGUAGES}
							onSelect={(code: string) => {
								if (pickerMode === 'source') {
									void storage.set({ sourceLang: code })
								} else if (pickerMode === 'target') {
									void storage.set({ targetLang: code })
								} else if (pickerMode === 'sendSource') {
									void storage.set({ sendSourceLang: code })
								} else if (pickerMode === 'sendTarget') {
									void storage.set({ sendTargetLang: code })
								}
								setPickerMode(null)
							}}
							onClose={() => setPickerMode(null)}
						/>
					) : null}
				</Stack>
			</ScrollView>
		</Page>
	)
}
