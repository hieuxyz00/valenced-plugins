import { getAssetIdByName } from '@valenced/assets'
import {
	ActionSheetActionCreators,
	AlertActionCreators,
	ToastActionCreators,
} from '@valenced/discord/actions'
import { Dispatcher } from '@valenced/discord/common/flux'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { getModuleWithImportedPath } from '@valenced/discord/utils/modules/finders'
import { after, before, instead } from '@valenced/patcher'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { createElement } from 'react'
import { formatTranslationResult } from './languages'
import { patchChatBar, setChatBarHieuxyzApi } from './patches/chatBar'
import { patchMessageReceive } from './patches/messageReceive'
import { patchMessageSend } from './patches/messageSend'
import SettingsComponent from './settings'
import { translateText } from './translator'
import { DefaultSettings } from './types'
import type { DiscordModules } from '@valenced/discord/types'
import type { JsonStorage } from '@valenced/json-storage'
import type { ComponentType, ReactElement } from 'react'
import type {
	ActionSheetRowElement,
	ActionSheetRowProps,
	ChannelMessagesCache,
	DiscordMessage,
	MessageLongPressActionSheetProps,
	MessageStore,
	Settings,
	TranslatedMessageState,
	TranslationProvider,
} from './types'

function isActionSheetRow(node: unknown): node is ActionSheetRowElement {
	if (typeof node !== 'object' || node === null || !('props' in node)) {
		return false
	}
	const props = (node as { props?: unknown }).props
	if (typeof props !== 'object' || props === null) {
		return false
	}
	const p = props as Record<string, unknown>
	const hasLabel = typeof p.label === 'string' || typeof p.message === 'string'
	const hasPress =
		typeof p.onPress === 'function' || typeof p.onPressRow === 'function'
	return hasLabel && hasPress
}

function findRowArray(node: unknown, depth = 0): unknown[] | undefined {
	if (typeof node !== 'object' || node === null || depth > 15) {
		return undefined
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findRowArray(child, depth + 1)
			if (found) return found
		}
		return undefined
	}
	if (!('props' in node)) return undefined
	const props = (node as { props?: unknown }).props
	if (typeof props !== 'object' || props === null) return undefined
	const p = props as { children?: unknown }
	const children = p.children
	if (Array.isArray(children)) {
		if (children.some(isActionSheetRow)) {
			return children
		}
		for (const child of children) {
			const found = findRowArray(child, depth + 1)
			if (found) return found
		}
	} else if (children) {
		if (isActionSheetRow(children)) {
			const array = [children]
			p.children = array
			return array
		}
		return findRowArray(children, depth + 1)
	}
	return undefined
}

const TOAST_KEY = 'hieuxyz.translator.toast'
const ALERT_KEY = 'hieuxyz.translator.alert'
const TRANSLATE_ROW_KEY = 'hieuxyz-translate'
const RESTORE_ROW_KEY = 'hieuxyz-restore'

export const originalMessages = new Map<string, TranslatedMessageState>()
export const localTranslations = new Map<string, string>()
export const localTranslatedObjects = new Map<
	string,
	{ embeds?: unknown[]; components?: unknown[] }
>()

let channelMessages: ChannelMessagesCache | undefined
let messageStore: MessageStore | undefined

function cloneMessage(
	message: DiscordMessage,
	content: string,
	embeds?: unknown[],
	components?: unknown[],
): DiscordMessage {
	const proto = Object.getPrototypeOf(message) as object | null
	const clone = (proto ? Object.create(proto) : {}) as DiscordMessage
	Object.defineProperties(clone, Object.getOwnPropertyDescriptors(message))
	clone.content = content
	if (embeds !== undefined) {
		clone.embeds = embeds
	}
	if (components !== undefined) {
		clone.components = components
	}
	return clone
}

async function translateEmbed(
	embed: Record<string, unknown>,
	provider: TranslationProvider,
	source: string,
	target: string,
): Promise<Record<string, unknown>> {
	const cloned = JSON.parse(JSON.stringify(embed)) as Record<string, unknown>
	if (typeof cloned.title === 'string' && cloned.title.trim()) {
		try {
			const res = await translateText(provider, cloned.title, source, target)
			cloned.title = res.text
		} catch {}
	}
	if (typeof cloned.description === 'string' && cloned.description.trim()) {
		try {
			const res = await translateText(
				provider,
				cloned.description,
				source,
				target,
			)
			cloned.description = res.text
		} catch {}
	}
	if (Array.isArray(cloned.fields)) {
		for (const field of cloned.fields as Array<Record<string, unknown>>) {
			if (typeof field.name === 'string' && field.name.trim()) {
				try {
					const res = await translateText(provider, field.name, source, target)
					field.name = res.text
				} catch {}
			}
			if (typeof field.value === 'string' && field.value.trim()) {
				try {
					const res = await translateText(provider, field.value, source, target)
					field.value = res.text
				} catch {}
			}
		}
	}
	if (
		cloned.footer &&
		typeof cloned.footer === 'object' &&
		typeof (cloned.footer as Record<string, unknown>).text === 'string'
	) {
		const footer = cloned.footer as Record<string, unknown>
		try {
			const res = await translateText(
				provider,
				footer.text as string,
				source,
				target,
			)
			footer.text = res.text
		} catch {}
	}
	if (
		cloned.author &&
		typeof cloned.author === 'object' &&
		typeof (cloned.author as Record<string, unknown>).name === 'string'
	) {
		const author = cloned.author as Record<string, unknown>
		try {
			const res = await translateText(
				provider,
				author.name as string,
				source,
				target,
			)
			author.name = res.text
		} catch {}
	}
	return cloned
}

async function translateComponentTree(
	component: Record<string, unknown>,
	provider: TranslationProvider,
	source: string,
	target: string,
): Promise<Record<string, unknown>> {
	const cloned = JSON.parse(JSON.stringify(component)) as Record<
		string,
		unknown
	>
	if (typeof cloned.label === 'string' && cloned.label.trim()) {
		try {
			const res = await translateText(provider, cloned.label, source, target)
			cloned.label = res.text
		} catch {}
	}
	if (typeof cloned.placeholder === 'string' && cloned.placeholder.trim()) {
		try {
			const res = await translateText(
				provider,
				cloned.placeholder,
				source,
				target,
			)
			cloned.placeholder = res.text
		} catch {}
	}
	if (typeof cloned.content === 'string' && cloned.content.trim()) {
		try {
			const res = await translateText(provider, cloned.content, source, target)
			cloned.content = res.text
		} catch {}
	}
	if (Array.isArray(cloned.options)) {
		for (const opt of cloned.options as Array<Record<string, unknown>>) {
			if (typeof opt.label === 'string' && opt.label.trim()) {
				try {
					const res = await translateText(provider, opt.label, source, target)
					opt.label = res.text
				} catch {}
			}
			if (typeof opt.description === 'string' && opt.description.trim()) {
				try {
					const res = await translateText(
						provider,
						opt.description,
						source,
						target,
					)
					opt.description = res.text
				} catch {}
			}
		}
	}
	if (Array.isArray(cloned.components)) {
		const children: unknown[] = []
		for (const child of cloned.components as Array<Record<string, unknown>>) {
			children.push(
				await translateComponentTree(child, provider, source, target),
			)
		}
		cloned.components = children
	}
	return cloned
}

function refreshMessages(): void {
	queueMicrotask(() => {
		try {
			messageStore?.emitChange?.()
		} catch {
			// ignore
		}
	})
}

function dispatchRerenderOnly(channelId: string, messageId: string): void {
	const payload = {
		type: 'MESSAGE_UPDATE',
		message: {
			id: messageId,
			channel_id: channelId,
		},
	}

	if (Dispatcher && typeof Dispatcher.dispatch === 'function') {
		if (
			typeof Dispatcher.isDispatching === 'function' &&
			Dispatcher.isDispatching()
		) {
			queueMicrotask(() => {
				void Dispatcher.dispatch(payload)
			})
		} else {
			void Dispatcher.dispatch(payload)
		}
	}
}

export function showToast(text: string): void {
	if (ToastActionCreators && typeof ToastActionCreators.open === 'function') {
		try {
			ToastActionCreators.open(TOAST_KEY, { text })
			return
		} catch {
			// Fall through to alert fallback
		}
	}

	if (
		AlertActionCreators &&
		typeof AlertActionCreators.openAlert === 'function'
	) {
		try {
			AlertActionCreators.openAlert(
				ALERT_KEY,
				createElement(Design.AlertModal, {
					title: 'Translator',
					content: createElement(Design.Text, null, text),
					actions: createElement(Design.AlertActionButton, {
						text: 'Okay',
						variant: 'primary',
						onPress: () => AlertActionCreators.dismissAlert(ALERT_KEY),
					}),
				}),
			)
			return
		} catch {
			// Silently finish
		}
	}
}

export async function translateMessage(
	message: DiscordMessage,
	storage: JsonStorage<Settings>,
): Promise<void> {
	const stored = originalMessages.get(message.id)
	const originalContent = stored
		? stored.originalContent
		: (message.content ?? '')
	const text = originalContent.trim()
	const channelId = message.channel_id
	const rawEmbeds = stored?.originalEmbeds ?? message.embeds
	const rawComponents = stored?.originalComponents ?? message.components

	const hasText = text.length > 0
	const hasEmbeds = Array.isArray(rawEmbeds) && rawEmbeds.length > 0
	const hasComponents = Array.isArray(rawComponents) && rawComponents.length > 0

	if (!hasText && !hasEmbeds && !hasComponents) {
		showToast('⚠️ No text, embed, or components to translate')
		return
	}

	const current = {
		...DefaultSettings,
		...(storage.cache as Partial<Settings> | undefined),
	}

	const provider = current.provider || DefaultSettings.provider
	const source = current.sourceLang || DefaultSettings.sourceLang
	const target = current.targetLang || DefaultSettings.targetLang

	try {
		let updatedContent = originalContent
		if (hasText) {
			const result = await translateText(provider, text, source, target)
			const effectiveProvider = result.usedProvider ?? provider
			const formatted = formatTranslationResult(
				result,
				effectiveProvider,
				source,
				target,
			)
			updatedContent = `${originalContent}\n\n${formatted}`
		}

		let translatedEmbeds: unknown[] | undefined
		if (hasEmbeds && Array.isArray(rawEmbeds)) {
			translatedEmbeds = await Promise.all(
				rawEmbeds.map(e =>
					typeof e === 'object' && e !== null
						? translateEmbed(
								e as Record<string, unknown>,
								provider,
								source,
								target,
							)
						: e,
				),
			)
		}

		let translatedComponents: unknown[] | undefined
		if (hasComponents && Array.isArray(rawComponents)) {
			translatedComponents = await Promise.all(
				rawComponents.map(c =>
					typeof c === 'object' && c !== null
						? translateComponentTree(
								c as Record<string, unknown>,
								provider,
								source,
								target,
							)
						: c,
				),
			)
		}

		if (!stored) {
			originalMessages.set(message.id, {
				channelId,
				originalContent,
				originalEmbeds: rawEmbeds
					? (JSON.parse(JSON.stringify(rawEmbeds)) as unknown[])
					: undefined,
				originalComponents: rawComponents
					? (JSON.parse(JSON.stringify(rawComponents)) as unknown[])
					: undefined,
			})
		}
		localTranslations.set(message.id, updatedContent)
		if (translatedEmbeds || translatedComponents) {
			localTranslatedObjects.set(message.id, {
				embeds: translatedEmbeds,
				components: translatedComponents,
			})
		}

		try {
			const collection = channelMessages?.getOrCreate(channelId)
			if (collection?.has(message.id)) {
				channelMessages?.commit(
					collection.update(message.id, msg =>
						cloneMessage(
							msg,
							updatedContent,
							translatedEmbeds,
							translatedComponents,
						),
					),
				)
			}
		} catch {
			// ignore
		}

		refreshMessages()
		dispatchRerenderOnly(channelId, message.id)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		showToast(`⚠️ Translation failed: ${errorMessage}`)
	}
}

export function restoreOriginalMessage(messageId: string): void {
	const stored = originalMessages.get(messageId)
	if (!stored) return

	const channelId = stored.channelId
	const originalContent = stored.originalContent
	const originalEmbeds = stored.originalEmbeds
	const originalComponents = stored.originalComponents

	originalMessages.delete(messageId)
	localTranslations.delete(messageId)
	localTranslatedObjects.delete(messageId)

	try {
		const collection = channelMessages?.getOrCreate(channelId)
		if (collection?.has(messageId)) {
			channelMessages?.commit(
				collection.update(messageId, msg =>
					cloneMessage(
						msg,
						originalContent,
						originalEmbeds,
						originalComponents,
					),
				),
			)
		}
	} catch {
		// ignore
	}

	refreshMessages()
	dispatchRerenderOnly(channelId, messageId)

	showToast('Restored original message')
}

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: { load: true, default: DefaultSettings },
	start({ cleanup, jsonStorage: storage, unscoped }) {
		let unpatchSheet: (() => void) | undefined

		const hieuxyz = unscoped?.hieuxyz
		setChatBarHieuxyzApi(hieuxyz)

		cleanup(
			getModuleWithImportedPath<{ default: ChannelMessagesCache }>(
				'lib/ChannelMessages.tsx',
				ns => {
					channelMessages = ns.default
				},
			),
		)

		const hookMessageStore = (store: MessageStore) => {
			messageStore = store
			cleanup(
				instead(store, 'getMessage', function (args, original) {
					const result = Reflect.apply(original, this, args) as
						| DiscordMessage
						| null
						| undefined
					if (!result) return result

					const translated = localTranslations.get(result.id)
					const extra = localTranslatedObjects.get(result.id)
					if (translated != null || extra != null) {
						return cloneMessage(
							result,
							translated ?? result.content ?? '',
							extra?.embeds,
							extra?.components,
						)
					}
					return result
				}),
			)
		}

		if (Stores?.MessageStore) {
			hookMessageStore(Stores.MessageStore as unknown as MessageStore)
		}

		cleanup(
			getModuleWithImportedPath<{ default: MessageStore }>(
				'stores/MessageStore.tsx',
				ns => {
					hookMessageStore(ns.default)
				},
			),
		)

		patchChatBar(cleanup, storage, showToast)
		patchMessageSend(cleanup, storage, showToast)
		patchMessageReceive(cleanup, storage, translateMessage)

		cleanup(() => {
			unpatchSheet?.()
			unpatchSheet = undefined
			setChatBarHieuxyzApi(undefined)

			for (const [messageId, state] of originalMessages) {
				try {
					const collection = channelMessages?.getOrCreate(state.channelId)
					if (collection?.has(messageId)) {
						channelMessages?.commit(
							collection.update(messageId, msg =>
								cloneMessage(msg, state.originalContent),
							),
						)
					}
				} catch {
					// ignore
				}
				dispatchRerenderOnly(state.channelId, messageId)
			}
			originalMessages.clear()
			localTranslations.clear()
			localTranslatedObjects.clear()
			refreshMessages()
			channelMessages = undefined
			messageStore = undefined
		})

		const unpatchOpenLazy = before(
			ActionSheetActionCreators,
			'openLazy',
			args => {
				const [sheetPromise, key, rawProps] = args
				if (key !== 'MessageLongPressActionSheet') return args

				const props = rawProps as MessageLongPressActionSheetProps | undefined
				const message = props?.message
				if (!message?.id) return args

				sheetPromise.then(instance => {
					if (
						typeof instance !== 'object' ||
						instance === null ||
						!('default' in instance)
					) {
						return
					}

					const target = instance as Record<
						'default',
						(...fnArgs: unknown[]) => ReactElement | null
					>

					if (typeof target.default !== 'function') return

					unpatchSheet?.()
					const unpatch = after(target, 'default', tree => {
						if (!tree) return tree

						const rows = findRowArray(tree)
						if (!rows) return tree

						const hasTranslate = rows.some(
							r =>
								typeof r === 'object' &&
								r !== null &&
								'key' in r &&
								(r as { key?: unknown }).key === TRANSLATE_ROW_KEY,
						)
						const hasRestore = rows.some(
							r =>
								typeof r === 'object' &&
								r !== null &&
								'key' in r &&
								(r as { key?: unknown }).key === RESTORE_ROW_KEY,
						)
						if (hasTranslate || hasRestore) return tree

						const sample = rows.find(isActionSheetRow)
						if (!sample) return tree

						const isTranslated = originalMessages.has(message.id)

						const createRow = (
							rowKey: string,
							label: string,
							onPress: () => void,
							icon?: ReactElement,
						) => {
							const rowProps: ActionSheetRowProps = sample.props.onPressRow
								? {
										key: rowKey,
										message: label,
										onPressRow: onPress,
										icon,
									}
								: {
										key: rowKey,
										label,
										onPress,
										icon,
									}

							return createElement(
								sample.type as ComponentType<ActionSheetRowProps>,
								rowProps,
							)
						}

						const RowIcon =
							(
								sample.type as ComponentType<ActionSheetRowProps> & {
									Icon?: ComponentType<DiscordModules.Components.TableRowIconProps>
								}
							).Icon ?? Design.ActionSheetRow?.Icon

						const translateIconComponent = lookupGeneratedIconComponent(
							'LanguageIcon',
							'GlobeEarthIcon',
							'GlobeIcon',
							'ChatIcon',
						)
						let translateIcon: ReactElement | undefined
						if (RowIcon) {
							if (translateIconComponent) {
								translateIcon = createElement(RowIcon, {
									IconComponent: translateIconComponent,
								})
							} else {
								try {
									const assetId =
										getAssetIdByName('LanguageIcon') ??
										getAssetIdByName('GlobeEarthIcon') ??
										getAssetIdByName('ic_language')
									if (assetId !== undefined) {
										translateIcon = createElement(RowIcon, {
											source: assetId,
										})
									}
								} catch {}
							}
						}

						const refreshIconComponent = lookupGeneratedIconComponent(
							'RetryIcon',
							'RefreshIcon',
						)
						let refreshIcon: ReactElement | undefined
						if (RowIcon) {
							if (refreshIconComponent) {
								refreshIcon = createElement(RowIcon, {
									IconComponent: refreshIconComponent,
								})
							} else {
								try {
									const assetId =
										getAssetIdByName('RetryIcon') ??
										getAssetIdByName('RefreshIcon')
									if (assetId !== undefined) {
										refreshIcon = createElement(RowIcon, {
											source: assetId,
										})
									}
								} catch {}
							}
						}

						const insertIndex = Math.min(1, rows.length)

						// When already translated: show ONLY Restore Original row
						// When not translated: show ONLY Translate row
						if (isTranslated) {
							const restoreRow = createRow(
								RESTORE_ROW_KEY,
								'Restore Original',
								() => {
									ActionSheetActionCreators.hideActionSheet()
									restoreOriginalMessage(message.id)
								},
								refreshIcon,
							)
							rows.splice(insertIndex, 0, restoreRow)
						} else {
							const translateRow = createRow(
								TRANSLATE_ROW_KEY,
								'Translate',
								() => {
									ActionSheetActionCreators.hideActionSheet()
									void translateMessage(message, storage)
								},
								translateIcon,
							)
							rows.splice(insertIndex, 0, translateRow)
						}

						return tree
					})

					unpatchSheet = unpatch
					cleanup(unpatch)
				})

				return args
			},
		)

		cleanup(unpatchOpenLazy)
	},
	SettingsComponent,
})
