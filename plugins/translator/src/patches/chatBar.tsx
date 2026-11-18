import {
	ActionSheetActionCreators,
	ToastActionCreators,
} from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { getModuleWithImportedPath } from '@valenced/discord/utils/modules/finders'
import { after } from '@valenced/patcher'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { createElement, useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'

const { Text } = Design

import { getLanguageName, LANGUAGES } from '../languages'
import { findInReactFiber, injectChatBarTranslatorButton } from '../logic'
import { DefaultSettings } from '../types'
import type { JsonStorage } from '@valenced/json-storage'
import type { FC, MemoExoticComponent, ReactElement, ReactNode } from 'react'
import type { MockReactElement } from '../logic'
import type { Settings } from '../types'

export { findInReactFiber, injectChatBarTranslatorButton }
export type { MockReactElement }

const ChatInputActionsPath =
	'modules/chat_input/native/action_buttons/ChatInputActions.tsx'
const ChatInputRightActionsPath =
	'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx'

export function SlashedTranslateSvg({
	size = 24,
	color = '#949BA4',
	slashColor = '#ED4245',
}: {
	size?: number
	color?: string
	slashColor?: string
}): ReactElement {
	const LanguageIcon =
		lookupGeneratedIconComponent('LanguageIcon') ??
		lookupGeneratedIconComponent('GlobeEarthIcon')

	return (
		<View
			style={{
				width: size,
				height: size,
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			{LanguageIcon ? (
				<LanguageIcon size="md" color={color} />
			) : (
				<Text
					style={{
						fontSize: Math.round(size * 0.65),
						fontWeight: '700',
						color,
					}}
				>
					A/文
				</Text>
			)}
			{slashColor && slashColor !== 'transparent' ? (
				<View
					pointerEvents="none"
					style={{
						position: 'absolute',
						width: size + 2,
						height: 2,
						backgroundColor: slashColor,
						borderRadius: 1,
						transform: [{ rotate: '-45deg' }],
					}}
				/>
			) : null}
		</View>
	)
}

let globalHieuxyzApi: import('../../../lib/src').HieuxyzApi | undefined

export function setChatBarHieuxyzApi(
	api?: import('../../../lib/src').HieuxyzApi,
): void {
	globalHieuxyzApi = api
}

export interface LanguagePickerRowProps {
	label: string
	subLabel?: string
	currentLang?: string
	onPress?: () => void
	onSelect?: (code: string) => void
}

export function LanguagePickerRow({
	label,
	subLabel,
	currentLang: _currentLang,
	onPress,
	onSelect: _onSelect,
}: LanguagePickerRowProps): ReactElement {
	return <Design.TableRow label={label} subLabel={subLabel} onPress={onPress} />
}

export interface SendSettingsModalProps {
	visible: boolean
	onClose: () => void
	settings: Settings
	onUpdateSettings: (partial: Partial<Settings>) => void
	currentChannelId?: string
	hieuxyz?: import('../../../lib/src').HieuxyzApi
}

export function SendSettingsModal({
	visible,
	onClose,
	settings,
	onUpdateSettings,
	currentChannelId,
	hieuxyz,
}: SendSettingsModalProps): ReactElement | null {
	if (!visible) return null

	const lib =
		hieuxyz ??
		globalHieuxyzApi ??
		(
			globalThis as {
				valenced?: { hieuxyz?: import('../../../lib/src').HieuxyzApi }
			}
		).valenced?.hieuxyz
	const PipModalComponent = lib?.PipModal
	const LanguagePickerModalComponent = lib?.LanguagePickerModal

	const [pickerMode, setPickerMode] = useState<
		'sendSource' | 'sendTarget' | 'revSource' | 'revTarget' | null
	>(null)

	const sendChannels = Array.isArray(settings.sendChannels)
		? settings.sendChannels
		: []
	const revChannels = Array.isArray(settings.revChannels)
		? settings.revChannels
		: []

	const isSendChannelActive = Boolean(
		currentChannelId && sendChannels.includes(currentChannelId),
	)
	const isRevChannelActive = Boolean(
		currentChannelId && revChannels.includes(currentChannelId),
	)

	const modalContent = (
		<View style={{ paddingVertical: 8 }}>
			<Design.Stack spacing={16}>
				<Design.TableRowGroup title="Send Languages">
					<LanguagePickerRow
						label="Send Source Language"
						subLabel={getLanguageName(settings.sendSourceLang)}
						currentLang={settings.sendSourceLang}
						onPress={() => setPickerMode('sendSource')}
						onSelect={(code: string) => {
							onUpdateSettings({ sendSourceLang: code })
						}}
					/>
					<LanguagePickerRow
						label="Send Target Language"
						subLabel={getLanguageName(settings.sendTargetLang)}
						currentLang={settings.sendTargetLang}
						onPress={() => setPickerMode('sendTarget')}
						onSelect={(code: string) => {
							onUpdateSettings({ sendTargetLang: code })
						}}
					/>
				</Design.TableRowGroup>

				<Design.TableRowGroup title="Send Auto-Translate Controls">
					<Design.TableSwitchRow
						label="Auto-Translate Send"
						subLabel="Translate all outgoing messages automatically"
						value={settings.autoTranslateSend}
						onValueChange={(val: boolean) => {
							onUpdateSettings({ autoTranslateSend: val })
						}}
					/>
					{currentChannelId ? (
						<Design.TableSwitchRow
							label="Auto-Translate Active Channel (Send)"
							subLabel={`Channel: ${currentChannelId}`}
							value={isSendChannelActive}
							onValueChange={(val: boolean) => {
								const set = new Set(sendChannels)
								if (val) {
									set.add(currentChannelId)
								} else {
									set.delete(currentChannelId)
								}
								onUpdateSettings({ sendChannels: Array.from(set) })
							}}
						/>
					) : null}
				</Design.TableRowGroup>

				<Design.TableRowGroup title="Receive Languages">
					<LanguagePickerRow
						label="Receive Source Language"
						subLabel={getLanguageName(settings.sourceLang)}
						currentLang={settings.sourceLang}
						onPress={() => setPickerMode('revSource')}
						onSelect={(code: string) => {
							onUpdateSettings({ sourceLang: code })
						}}
					/>
					<LanguagePickerRow
						label="Receive Target Language"
						subLabel={getLanguageName(settings.targetLang)}
						currentLang={settings.targetLang}
						onPress={() => setPickerMode('revTarget')}
						onSelect={(code: string) => {
							onUpdateSettings({ targetLang: code })
						}}
					/>
				</Design.TableRowGroup>

				<Design.TableRowGroup title="Receive Auto-Translate Controls">
					<Design.TableSwitchRow
						label="Auto-Translate Receive"
						subLabel="Translate all incoming messages automatically"
						value={settings.autoTranslateRev}
						onValueChange={(val: boolean) => {
							onUpdateSettings({ autoTranslateRev: val })
						}}
					/>
					{currentChannelId ? (
						<Design.TableSwitchRow
							label="Auto-Translate Active Channel (Receive)"
							subLabel={`Channel: ${currentChannelId}`}
							value={isRevChannelActive}
							onValueChange={(val: boolean) => {
								const set = new Set(revChannels)
								if (val) {
									set.add(currentChannelId)
								} else {
									set.delete(currentChannelId)
								}
								onUpdateSettings({ revChannels: Array.from(set) })
							}}
						/>
					) : null}
				</Design.TableRowGroup>
			</Design.Stack>

			{LanguagePickerModalComponent && pickerMode !== null ? (
				<LanguagePickerModalComponent
					visible={pickerMode !== null}
					title={
						pickerMode === 'sendSource'
							? 'Select Send Source Language'
							: pickerMode === 'sendTarget'
								? 'Select Send Target Language'
								: pickerMode === 'revSource'
									? 'Select Receive Source Language'
									: 'Select Receive Target Language'
					}
					current={
						pickerMode === 'sendSource'
							? settings.sendSourceLang
							: pickerMode === 'sendTarget'
								? settings.sendTargetLang
								: pickerMode === 'revSource'
									? settings.sourceLang
									: settings.targetLang
					}
					allowAuto={pickerMode === 'sendSource' || pickerMode === 'revSource'}
					languages={LANGUAGES}
					onSelect={(code: string) => {
						if (pickerMode === 'sendSource') {
							onUpdateSettings({ sendSourceLang: code })
						} else if (pickerMode === 'sendTarget') {
							onUpdateSettings({ sendTargetLang: code })
						} else if (pickerMode === 'revSource') {
							onUpdateSettings({ sourceLang: code })
						} else if (pickerMode === 'revTarget') {
							onUpdateSettings({ targetLang: code })
						}
						setPickerMode(null)
					}}
					onClose={() => setPickerMode(null)}
				/>
			) : null}
		</View>
	)

	const fallbackKeyRef = useRef('translator-quick-settings-sheet')

	useEffect(() => {
		if (!PipModalComponent && visible) {
			const SheetComponent = () => (
				<Design.ActionSheet onDismiss={onClose}>
					{modalContent}
				</Design.ActionSheet>
			)
			ActionSheetActionCreators.openLazy(
				Promise.resolve({ default: SheetComponent }),
				fallbackKeyRef.current,
				{},
			)
		} else if (!PipModalComponent && !visible) {
			ActionSheetActionCreators.hideActionSheet(fallbackKeyRef.current)
		}
		return () => {
			if (!PipModalComponent) {
				ActionSheetActionCreators.hideActionSheet(fallbackKeyRef.current)
			}
		}
	}, [visible, PipModalComponent, onClose, modalContent])

	if (PipModalComponent) {
		return (
			<PipModalComponent
				visible={visible}
				onClose={onClose}
				title="Translator Quick Settings"
			>
				{modalContent}
			</PipModalComponent>
		)
	}

	return null
}

export const QuickSettingsModal = SendSettingsModal
export type QuickSettingsModalProps = SendSettingsModalProps

export function TranslatorChatBarButton({
	storage,
	showToast,
}: {
	storage: JsonStorage<Settings>
	showToast?: (msg: string) => void
}): ReactElement | null {
	const settings: Settings = {
		...DefaultSettings,
		...(storage.use() as Partial<Settings> | undefined),
	}
	const [modalVisible, setModalVisible] = useState(false)
	const isEnabled = settings.autoTranslateSend

	const handlePress = (event?: unknown) => {
		if (
			event &&
			typeof event === 'object' &&
			'stopPropagation' in event &&
			typeof (event as { stopPropagation?: unknown }).stopPropagation ===
				'function'
		) {
			;(event as { stopPropagation: () => void }).stopPropagation()
		}
		const next = !settings.autoTranslateSend
		void storage.set({ autoTranslateSend: next })
		const text = `Auto-Translate Send: ${next ? 'Enabled' : 'Disabled'}`
		if (showToast) {
			showToast(text)
		} else if (ToastActionCreators?.open) {
			ToastActionCreators.open('translator-send-toggle', { text })
		}
	}

	const handleLongPress = (event?: unknown) => {
		if (
			event &&
			typeof event === 'object' &&
			'stopPropagation' in event &&
			typeof (event as { stopPropagation?: unknown }).stopPropagation ===
				'function'
		) {
			;(event as { stopPropagation: () => void }).stopPropagation()
		}
		setModalVisible(true)
	}

	const currentChannelId = (
		Stores?.SelectedChannelStore as { getChannelId?: () => string } | undefined
	)?.getChannelId?.()

	const LanguageIcon =
		lookupGeneratedIconComponent('LanguageIcon') ??
		lookupGeneratedIconComponent('GlobeEarthIcon')

	return (
		<>
			<Pressable
				testID="valenced-translator-chat-button"
				accessibilityLabel="Translator"
				accessibilityRole="button"
				accessibilityState={{
					selected: isEnabled,
				}}
				onPress={handlePress}
				onLongPress={handleLongPress}
				delayLongPress={300}
				hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
				style={({ pressed }) => ({
					width: 40,
					height: 40,
					justifyContent: 'center',
					alignItems: 'center',
					opacity: pressed ? 0.6 : 1,
				})}
			>
				{isEnabled ? (
					LanguageIcon ? (
						<LanguageIcon size="md" color="#5865F2" />
					) : (
						<SlashedTranslateSvg
							size={24}
							color="#5865F2"
							slashColor="transparent"
						/>
					)
				) : (
					<SlashedTranslateSvg size={24} color="#949BA4" slashColor="#ED4245" />
				)}
			</Pressable>

			<SendSettingsModal
				visible={modalVisible}
				onClose={() => setModalVisible(false)}
				settings={settings}
				onUpdateSettings={partial => {
					void storage.set(partial)
				}}
				currentChannelId={currentChannelId}
			/>
		</>
	)
}

export function patchChatBar(
	cleanup: (cb: () => void) => void,
	storage: JsonStorage<Settings>,
	showToast?: (msg: string) => void,
): void {
	const insertButton = (
		tree: ReactElement,
		side: Settings['chatButtonPosition'],
	): ReactElement => {
		const node = findInReactFiber(
			tree,
			(n): n is { props: { children: ReactNode[] } } =>
				typeof n === 'object' &&
				n !== null &&
				'props' in n &&
				typeof (n as { props?: unknown }).props === 'object' &&
				(n as { props?: unknown }).props !== null &&
				Array.isArray((n as { props: { children?: unknown } }).props.children),
		)
		if (!node) return tree

		const { children } = node.props
		const prevIdx = children.findIndex(
			c =>
				typeof c === 'object' &&
				c !== null &&
				'key' in c &&
				(c as { key?: unknown }).key === 'valenced-translator-chat-button',
		)
		if (prevIdx !== -1) {
			children.splice(prevIdx, 1)
		}

		const currentSettings: Settings = {
			...DefaultSettings,
			...(storage.cache as Partial<Settings> | undefined),
		}
		if (
			!currentSettings.chatButtonEnabled ||
			currentSettings.chatButtonPosition !== side
		) {
			return tree
		}

		const buttonElement = createElement(TranslatorChatBarButton, {
			key: 'valenced-translator-chat-button',
			storage,
			showToast,
		})

		if (side === 'left') {
			children.push(buttonElement)
		} else {
			children.unshift(buttonElement)
		}

		return tree
	}

	cleanup(
		getModuleWithImportedPath<{ default: MemoExoticComponent<FC> }>(
			ChatInputActionsPath,
			({ default: ChatInputActions }) => {
				cleanup(
					after(ChatInputActions, 'type', (tree: unknown) =>
						insertButton(tree as ReactElement, 'left'),
					),
				)
			},
		),
	)

	cleanup(
		getModuleWithImportedPath<{ default: MemoExoticComponent<FC> }>(
			ChatInputRightActionsPath,
			({ default: ChatInputRightActions }) => {
				cleanup(
					after(ChatInputRightActions, 'type', (tree: unknown) =>
						insertButton(tree as ReactElement, 'right'),
					),
				)
			},
		),
	)
}
