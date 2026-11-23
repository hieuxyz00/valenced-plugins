import { TableRowAssetIcon } from '@valenced/components'
import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { lookupModuleWithImportedPath } from '@valenced/discord/utils/modules/finders'
import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useSharedThemeTokens } from '../../../../shared/theme'
import { ModalKeys, UNICODE_EMOJIS_IMPORTED_PATH } from '../constants'
import {
	cleanupEmojiPickerPatch,
	EmojiIntention,
	formatEmoji,
	getHieuxyzLib,
	isGuildOrUnicodeEmoji,
	openDiscordEmojiPicker,
} from '../utils/discordEmojiPicker'
import { showToast } from '../utils/toast'
import { setVoiceChannelStatus } from '../utils/voiceApi'
import type { VoiceStatusModalProps } from '../types'

function getChatSmileIcon() {
	return lookupGeneratedIconComponent('ChatSmileIcon')
}

function extractText(val: unknown): string {
	if (typeof val === 'string') return val
	if (val && typeof val === 'object' && val !== null) {
		const obj = val as Record<string, unknown>
		if (typeof obj.text === 'string') return obj.text
		if (typeof obj.value === 'string') return obj.value
		if (obj.nativeEvent && typeof obj.nativeEvent === 'object') {
			const ne = obj.nativeEvent as Record<string, unknown>
			if (typeof ne.text === 'string') return ne.text
		}
	}
	return ''
}

const statusDraft = {
	channelId: '',
	text: '',
	listeners: new Set<(text: string) => void>(),
}

function updateDraftText(channelId: string, text: string): void {
	statusDraft.channelId = channelId
	statusDraft.text = text
	for (const fn of statusDraft.listeners) {
		try {
			fn(text)
		} catch {}
	}
}

function clearDraft(): void {
	statusDraft.channelId = ''
	statusDraft.text = ''
	cleanupEmojiPickerPatch()
}

export interface DefaultEmojiItem {
	char: string
	keywords: string
	name: string
}

let cachedDefaultEmojis: readonly DefaultEmojiItem[] | undefined

export function getDefaultEmojis(): readonly DefaultEmojiItem[] {
	if (cachedDefaultEmojis && cachedDefaultEmojis.length > 0) {
		return cachedDefaultEmojis
	}

	const lib = getHieuxyzLib()
	if (lib?.getDefaultUnicodeEmojis) {
		const libEmojis = lib.getDefaultUnicodeEmojis()
		if (libEmojis.length > 0) {
			const mapped = libEmojis.map(e => ({
				char: e.char ?? e.formatted,
				name: e.name ?? '',
				keywords: e.keywords ?? '',
			}))
			cachedDefaultEmojis = Object.freeze(mapped)
			return cachedDefaultEmojis
		}
	}

	try {
		const [pathMod, pathId] = lookupModuleWithImportedPath<
			Record<string, unknown>
		>(UNICODE_EMOJIS_IMPORTED_PATH)
		const [propsMod] = lookupModule(withProps('convertNameToSurrogate'))
		const raw = pathId !== undefined && pathMod ? pathMod : propsMod
		const utils = ((raw as Record<string, unknown>)?.default ?? raw) as
			| {
					getCategories?: () => string[]
					getByCategory?: (cat: string) => Array<{
						surrogates?: string
						uniqueName?: string
						emojiObject?: { surrogates?: string; names?: string[] }
					}>
					forEach?: (
						fn: (emoji: {
							surrogates?: string
							uniqueName?: string
							emojiObject?: { surrogates?: string; names?: string[] }
						}) => void,
					) => void
			  }
			| undefined

		if (utils) {
			const list: DefaultEmojiItem[] = []
			const seen = new Set<string>()

			const addEmoji = (e: {
				surrogates?: string
				uniqueName?: string
				emojiObject?: { surrogates?: string; names?: string[] }
			}) => {
				const char = e.surrogates || e.emojiObject?.surrogates
				if (!char || seen.has(char)) return
				seen.add(char)
				const name = e.uniqueName || ''
				const names = e.emojiObject?.names || []
				const keywords = `${names.join(' ')} ${name}`.trim().toLowerCase()
				list.push({ char, name, keywords })
			}

			if (typeof utils.forEach === 'function') {
				utils.forEach(addEmoji)
			} else if (
				typeof utils.getCategories === 'function' &&
				typeof utils.getByCategory === 'function'
			) {
				const cats = utils.getCategories()
				for (const cat of cats) {
					const items = utils.getByCategory(cat) || []
					for (const item of items) {
						addEmoji(item)
					}
				}
			}

			if (list.length > 0) {
				cachedDefaultEmojis = Object.freeze(list)
				return cachedDefaultEmojis
			}
		}
	} catch {}

	return []
}

export function openVoiceStatusModal(props: VoiceStatusModalProps): void {
	const initial =
		props.draftText !== undefined
			? props.draftText
			: (props.initialStatus ?? '')

	statusDraft.channelId = props.channel.id
	statusDraft.text = initial

	ActionSheetActionCreators.openLazy(
		Promise.resolve({ default: VoiceStatusSheetContent }),
		ModalKeys.VOICE_STATUS,
		{ ...props, startExpanded: false },
		'replaceTopSheet',
	)
}

function VoiceStatusSheetContent({
	channel,
	initialStatus = '',
}: VoiceStatusModalProps) {
	const { ActionSheet, Button, Text, TextInput } = Design
	const themeTokens = useSharedThemeTokens()
	const ChatSmileIcon = getChatSmileIcon()

	const currentDraftText =
		statusDraft.channelId === channel.id ? statusDraft.text : initialStatus

	const [statusText, setStatusText] = useState(currentDraftText)
	const [loading, setLoading] = useState(false)
	const [showEmojiPicker, setShowEmojiPicker] = useState(true)
	const [hieuxyzLib, setHieuxyzLib] = useState(() => getHieuxyzLib())

	const guildId = channel.guild_id ?? channel.guildId ?? ''

	useEffect(() => {
		return () => {
			cleanupEmojiPickerPatch()
		}
	}, [])

	useEffect(() => {
		if (hieuxyzLib?.DiscordEmojiPicker) return
		let active = true
		const timer = setInterval(() => {
			const api = getHieuxyzLib()
			if (api?.DiscordEmojiPicker && active) {
				setHieuxyzLib(api)
				clearInterval(timer)
			}
		}, 100)
		const timeout = setTimeout(() => {
			active = false
			clearInterval(timer)
		}, 3000)
		return () => {
			active = false
			clearInterval(timer)
			clearTimeout(timeout)
		}
	}, [hieuxyzLib])

	useEffect(() => {
		const initial =
			statusDraft.channelId === channel.id ? statusDraft.text : initialStatus
		setStatusText(initial)

		const listener = (newText: string) => {
			setStatusText(prev => (prev === newText ? prev : newText))
		}
		statusDraft.listeners.add(listener)
		return () => {
			statusDraft.listeners.delete(listener)
		}
	}, [channel.id, initialStatus])

	const handleTextChange = (val: unknown) => {
		const text = extractText(val)
		setStatusText(text)
		updateDraftText(channel.id, text)
	}

	const handleInsertEmoji = (formatted: string) => {
		if (!formatted) return
		const current = extractText(
			statusDraft.channelId === channel.id ? statusDraft.text : statusText,
		).trim()
		const next = current ? `${current} ${formatted}` : formatted
		updateDraftText(channel.id, next)
		setStatusText(next)
	}

	const handleOpenDiscordEmojiPicker = () => {
		const handleSelectEmoji = (emoji: unknown) => {
			if (!isGuildOrUnicodeEmoji(emoji, guildId)) {
				showToast(
					'Only current server and default emojis are supported',
					'voice-status-guild-only',
				)
				return
			}
			const formatted = formatEmoji(emoji)
			if (formatted) {
				handleInsertEmoji(formatted)
			}
		}

		openDiscordEmojiPicker({
			channel,
			guildId,
			pickerIntention: EmojiIntention.VOICE_CHANNEL_TOPIC,
			emojiPickerIntention: EmojiIntention.VOICE_CHANNEL_TOPIC,
			closeOnSelect: false,
			onlyCurrentGuild: true,
			onInvalidGuildEmoji: () => {
				showToast(
					'Only current server and default emojis are supported',
					'voice-status-guild-only',
				)
			},
			onPressEmoji: handleSelectEmoji,
		})
	}

	const handleSave = async () => {
		const finalStatus = extractText(statusText).trim()
		setLoading(true)
		try {
			const success = await setVoiceChannelStatus(
				channel.id,
				finalStatus,
				guildId,
			)
			if (success) {
				clearDraft()
				showToast(
					finalStatus
						? 'Voice channel status updated'
						: 'Voice channel status cleared',
					'voice-status-success',
				)
				ActionSheetActionCreators.hideActionSheet()
			} else {
				showToast('Failed to update voice status', 'voice-status-error')
			}
		} finally {
			setLoading(false)
		}
	}

	const handleClear = async () => {
		setLoading(true)
		try {
			const success = await setVoiceChannelStatus(channel.id, '', guildId)
			if (success) {
				clearDraft()
				showToast('Voice channel status cleared', 'voice-status-cleared')
				ActionSheetActionCreators.hideActionSheet()
			} else {
				showToast('Failed to clear voice status', 'voice-clear-error')
			}
		} finally {
			setLoading(false)
		}
	}

	const trimmed = extractText(statusText).trim()
	const isDirty = trimmed !== (initialStatus ?? '').trim()
	const canSave = !loading && (isDirty || Boolean(trimmed))

	const LibEmojiPicker = hieuxyzLib?.DiscordEmojiPicker

	return (
		<ActionSheet
			startExpanded={false}
			scrollable={false}
			onDismiss={clearDraft}
		>
			<View style={{ paddingHorizontal: 16, paddingBottom: 20, paddingTop: 8 }}>
				<View style={{ marginBottom: 12 }}>
					<Text
						variant="heading-lg/semibold"
						style={{ marginBottom: 4, color: themeTokens.textHeader }}
					>
						Voice Channel Status
					</Text>
					<Text
						variant="text-sm/normal"
						style={{ color: themeTokens.textMuted }}
					>
						Update status for #{channel.name ?? 'voice-channel'}
					</Text>
				</View>

				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 10,
						marginBottom: 10,
					}}
				>
					<View style={{ flex: 1, justifyContent: 'center' }}>
						<TextInput
							key="voice-status-main-status-input"
							placeholder="What's happening in voice?"
							value={statusText}
							onChange={handleTextChange}
							isClearable
							clearable
							onClear={() => handleTextChange('')}
						/>
					</View>

					<Pressable
						onPress={() => setShowEmojiPicker(prev => !prev)}
						hitSlop={8}
						style={({ pressed }) => ({
							width: 40,
							height: 40,
							justifyContent: 'center',
							alignItems: 'center',
							backgroundColor: 'transparent',
							opacity: pressed ? 0.6 : 1,
						})}
					>
						{ChatSmileIcon ? (
							<ChatSmileIcon
								size="md"
								color={
									showEmojiPicker ? 'interactive-active' : 'interactive-normal'
								}
							/>
						) : (
							<TableRowAssetIcon name="ChatSmileIcon" />
						)}
					</Pressable>
				</View>

				{showEmojiPicker && (
					<View style={{ marginBottom: 12 }}>
						{LibEmojiPicker ? (
							<LibEmojiPicker
								guildId={guildId}
								channel={channel}
								onSelect={handleInsertEmoji}
								onOpenDiscordPicker={handleOpenDiscordEmojiPicker}
								allowDiscordPicker={true}
								height={180}
							/>
						) : (
							<Pressable
								onPress={handleOpenDiscordEmojiPicker}
								style={({ pressed }) => ({
									padding: 12,
									borderRadius: 12,
									backgroundColor: pressed
										? themeTokens.bgModifierHover
										: themeTokens.bgModifierAccent,
									alignItems: 'center',
									justifyContent: 'center',
								})}
							>
								<Text
									variant="text-sm/normal"
									style={{ color: themeTokens.textMuted }}
								>
									Browse Discord Emoji Picker
								</Text>
							</Pressable>
						)}
					</View>
				)}

				<View style={{ gap: 8 }}>
					<Button
						key="save-btn"
						text={
							loading
								? 'Saving...'
								: initialStatus
									? 'Update Channel Status'
									: 'Set Channel Status'
						}
						variant="primary"
						disabled={!canSave}
						onPress={handleSave}
					/>
					{initialStatus ? (
						<Button
							key="clear-btn"
							text={loading ? 'Clearing...' : 'Clear Status'}
							variant="destructive"
							disabled={loading}
							onPress={handleClear}
						/>
					) : null}
					<Button
						key="cancel-btn"
						text="Cancel"
						variant="secondary"
						disabled={loading}
						onPress={() => {
							clearDraft()
							ActionSheetActionCreators.hideActionSheet()
						}}
					/>
				</View>
			</View>
		</ActionSheet>
	)
}
