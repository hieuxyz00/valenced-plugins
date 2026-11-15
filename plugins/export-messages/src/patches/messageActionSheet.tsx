import { getAssetIdByName } from '@valenced/assets'
import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { after, before } from '@valenced/patcher'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { createElement } from 'react'
import { openExportModal } from '../components/ExportModal'
import { DefaultSettings } from '../types'
import type { JsonStorage } from '@valenced/json-storage'
import type { ComponentType, ReactElement } from 'react'
import type { DiscordMessage, Settings } from '../types'

interface MessageLongPressActionSheetProps {
	message?: DiscordMessage
	channel?: { id?: string }
	[key: string]: unknown
}

interface ActionSheetRowProps {
	key?: string
	label?: string
	message?: string
	onPress?: () => void
	onPressRow?: () => void
	icon?: ReactElement
}

function isActionSheetRow(node: unknown): boolean {
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

const EXPORT_ROW_KEY = 'hieuxyz-export-chat-row'

export function patchMessageActionSheet(
	cleanup: (...fns: Array<() => void>) => void,
	jsonStorage: JsonStorage<Settings>,
): void {
	let unpatchSheet: (() => void) | undefined

	const unpatchOpenLazy = before(
		ActionSheetActionCreators,
		'openLazy',
		args => {
			const [sheetPromise, key, rawProps] = args
			if (
				key !== 'MessageLongPressActionSheet' &&
				key !== 'MessageActionSheet'
			) {
				return args
			}

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

					const hasExport = rows.some(
						r =>
							typeof r === 'object' &&
							r !== null &&
							'key' in r &&
							(r as { key?: unknown }).key === EXPORT_ROW_KEY,
					)
					if (hasExport) return tree

					const sample = rows.find(isActionSheetRow) as
						| {
								type: ComponentType<ActionSheetRowProps> & {
									Icon?: ComponentType<{
										IconComponent?: unknown
										source?: number
									}>
								}
								props: ActionSheetRowProps
						  }
						| undefined
					if (!sample) return tree

					const currentSettings: Settings = {
						...DefaultSettings,
						...(jsonStorage.cache as Partial<Settings> | undefined),
					}
					const channelId = message.channel_id ?? props?.channel?.id

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
						sample.type.Icon ??
						(
							Design.ActionSheetRow as unknown as {
								Icon?: ComponentType<{
									IconComponent?: unknown
									source?: number
								}>
							}
						)?.Icon

					const shareIconComponent = lookupGeneratedIconComponent(
						'ShareIcon',
						'DownloadIcon',
						'ChatIcon',
					)
					let shareIcon: ReactElement | undefined
					if (RowIcon) {
						if (shareIconComponent) {
							shareIcon = createElement(RowIcon, {
								IconComponent: shareIconComponent,
							})
						} else {
							try {
								const assetId =
									getAssetIdByName('ShareIcon') ??
									getAssetIdByName('DownloadIcon') ??
									getAssetIdByName('ic_share')
								if (assetId !== undefined) {
									shareIcon = createElement(RowIcon, { source: assetId })
								}
							} catch {}
						}
					}

					const insertIndex = Math.min(1, rows.length)
					const exportRow = createRow(
						EXPORT_ROW_KEY,
						'Export Chat',
						() => {
							ActionSheetActionCreators.hideActionSheet()
							openExportModal({
								alertKey: 'valenced-export-chat-dialog',
								initialMessage: message,
								initialChannelId: channelId,
								settings: currentSettings,
							})
						},
						shareIcon,
					)
					rows.splice(insertIndex, 0, exportRow)

					return tree
				})

				unpatchSheet = unpatch
				cleanup(unpatch)
			})

			return args
		},
	)

	cleanup(() => {
		unpatchOpenLazy()
		unpatchSheet?.()
		unpatchSheet = undefined
	})
}
