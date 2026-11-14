import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { useState } from 'react'
import {
	Modal,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from 'react-native'
import { getLanguageName, LANGUAGES } from './languages'
import { DefaultSettings } from './types'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings, TranslationProvider } from './types'

const {
	Stack,
	TableRadioGroup,
	TableRadioRow,
	TableRow,
	TableRowGroup,
	TableSwitchRow,
} = Design

interface ChannelInputModalProps {
	visible: boolean
	title: string
	channels: string[]
	onSave: (channels: string[]) => void
	onClose: () => void
}

function ChannelInputModal({
	visible,
	title,
	channels,
	onSave,
	onClose,
}: ChannelInputModalProps) {
	const [text, setText] = useState(() => channels.join('\n'))

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<Pressable
				onPress={onClose}
				style={{
					flex: 1,
					backgroundColor: 'rgba(0, 0, 0, 0.7)',
					justifyContent: 'center',
					alignItems: 'center',
					padding: 16,
				}}
			>
				<Pressable
					onPress={e => e.stopPropagation()}
					style={{
						width: '100%',
						maxWidth: 420,
						maxHeight: '80%',
						backgroundColor: '#1E1F22',
						borderRadius: 16,
						padding: 20,
						borderWidth: 1,
						borderColor: '#35363C',
					}}
				>
					<Text
						style={{
							fontSize: 18,
							fontWeight: '700',
							color: '#F2F3F5',
							marginBottom: 4,
						}}
					>
						{title}
					</Text>
					<Text
						style={{
							fontSize: 13,
							color: '#949BA4',
							marginBottom: 14,
						}}
					>
						Paste or enter channel IDs separated by spaces, commas, or newlines.
					</Text>

					<TextInput
						multiline
						numberOfLines={6}
						value={text}
						onChangeText={setText}
						placeholder="e.g. 112233445566 778899001122"
						placeholderTextColor="#5C5E66"
						style={{
							backgroundColor: '#2B2D31',
							color: '#F2F3F5',
							borderRadius: 8,
							padding: 12,
							minHeight: 120,
							maxHeight: 200,
							textAlignVertical: 'top',
							fontSize: 14,
							borderWidth: 1,
							borderColor: '#3F4147',
							marginBottom: 16,
						}}
					/>

					<View
						style={{
							flexDirection: 'row',
							justifyContent: 'flex-end',
							gap: 10,
						}}
					>
						<Pressable
							onPress={() => {
								setText('')
								onSave([])
								onClose()
							}}
							style={{
								paddingHorizontal: 14,
								paddingVertical: 10,
								borderRadius: 8,
								backgroundColor: '#DA373C',
							}}
						>
							<Text
								style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}
							>
								Clear All
							</Text>
						</Pressable>
						<Pressable
							onPress={onClose}
							style={{
								paddingHorizontal: 14,
								paddingVertical: 10,
								borderRadius: 8,
								backgroundColor: '#35363C',
							}}
						>
							<Text
								style={{ color: '#F2F3F5', fontWeight: '600', fontSize: 13 }}
							>
								Cancel
							</Text>
						</Pressable>
						<Pressable
							onPress={() => {
								const parsed = text
									.split(/[,\s\n]+/)
									.map(s => s.trim())
									.filter(s => s.length > 0 && /^\d+$/.test(s))
								const unique = Array.from(new Set(parsed))
								onSave(unique)
								onClose()
							}}
							style={{
								paddingHorizontal: 16,
								paddingVertical: 10,
								borderRadius: 8,
								backgroundColor: '#5865F2',
							}}
						>
							<Text
								style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}
							>
								Save
							</Text>
						</Pressable>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	)
}

type SettingsComponentProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: Settings }>
>

export default function SettingsComponent({ api }: SettingsComponentProps) {
	const storage = api.jsonStorage
	const hieuxyz = api.hieuxyz ?? api.unscoped?.hieuxyz
	const LanguagePickerModal = hieuxyz?.LanguagePickerModal

	const saved = storage.use()
	const settings: Settings = {
		...DefaultSettings,
		...(saved as Partial<Settings> | undefined),
	}
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
	const [channelModalMode, setChannelModalMode] = useState<
		'send' | 'rev' | null
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
				return 'auto'
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
							onPress={() => setChannelModalMode('send')}
						/>
						<TableRow
							label="Receive Auto-Translate Channels"
							subLabel={
								revChannels.length > 0
									? `${revChannels.length} channels configured (tap to edit/bulk paste IDs)`
									: 'None (tap to add or bulk paste channel IDs)'
							}
							onPress={() => setChannelModalMode('rev')}
						/>
					</TableRowGroup>

					{channelModalMode ? (
						<ChannelInputModal
							visible={channelModalMode !== null}
							title={
								channelModalMode === 'send'
									? 'Send Auto-Translate Channels'
									: 'Receive Auto-Translate Channels'
							}
							channels={
								channelModalMode === 'send' ? sendChannels : revChannels
							}
							onSave={newChannels => {
								if (channelModalMode === 'send') {
									void storage.set({ sendChannels: newChannels })
								} else {
									void storage.set({ revChannels: newChannels })
								}
							}}
							onClose={() => setChannelModalMode(null)}
						/>
					) : null}

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
