import { getAssetIdByName } from '@valenced/assets'
import {
	ActionSheetActionCreators,
	AlertActionCreators,
} from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import {
	getModuleWithImportedPath,
	lookupModuleWithImportedPath,
} from '@valenced/discord/utils/modules/finders'
import { getModules, lookupModule } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { before, instead } from '@valenced/patcher'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { cloneElement, createElement, isValidElement } from 'react'
import { View } from 'react-native'
import { openChannelPickerMove } from '../components/ChannelPicker'
import { openVoiceStatusModal } from '../components/VoiceStatusModal'
import {
	CHANNEL_LONG_PRESS_IMPORTED_PATH,
	ModalKeys,
	RowKeys,
} from '../constants'
import { DefaultSettings } from '../types'
import {
	canDeafenMembers,
	canMoveMembers,
	canMuteMembers,
	canSetVoiceStatus,
	isVoiceChannel,
} from '../utils/permissions'
import { showToast } from '../utils/toast'
import {
	deafenMembers,
	disconnectMembers,
	getChannelStatus,
	getGuildVoiceChannels,
	getVoiceChannelMembers,
	moveMembers,
	muteMembers,
} from '../utils/voiceApi'
import type { JsonStorage } from '@valenced/json-storage'
import type { ReactElement, ReactNode } from 'react'
import type { ChannelRecord, ChannelStoreExports, Settings } from '../types'

type SheetElement = ReactElement<Record<string, unknown>>

interface ActionSheetModule {
	default: (props: Record<string, unknown>) => SheetElement | null
}

export function getChannelRecord(rawProps: unknown): ChannelRecord | undefined {
	if (!rawProps || typeof rawProps !== 'object') return undefined
	const p = rawProps as Record<string, unknown>

	let channelStore: ChannelStoreExports | undefined
	try {
		channelStore = Stores.ChannelStore as unknown as
			| ChannelStoreExports
			| undefined
	} catch {}

	let channelCandidate: ChannelRecord | undefined

	try {
		if (p.channel && typeof p.channel === 'object') {
			channelCandidate = p.channel as ChannelRecord
		} else if (
			p.target &&
			typeof p.target === 'object' &&
			(p.target as { channel?: unknown }).channel
		) {
			channelCandidate = (p.target as { channel: ChannelRecord }).channel
		} else if (p.channelId && typeof p.channelId === 'object') {
			channelCandidate = p.channelId as ChannelRecord
		} else if (typeof p.channelId === 'string' && channelStore?.getChannel) {
			channelCandidate = channelStore.getChannel(p.channelId)
		} else if (typeof p.channel === 'string' && channelStore?.getChannel) {
			channelCandidate = channelStore.getChannel(p.channel)
		}

		if (channelCandidate?.id && channelStore?.getChannel) {
			const storeChannel = channelStore.getChannel(channelCandidate.id)
			if (storeChannel) {
				return storeChannel
			}
		}
	} catch {}

	return channelCandidate
}

export function isVoiceUtilsGroup(node: unknown): boolean {
	if (!node || typeof node !== 'object') return false
	const key = (node as { key?: unknown }).key
	if (typeof key === 'string') {
		if (
			key === 'valenced-voice-utils-group' ||
			key === RowKeys.VOICE_STATUS ||
			key === RowKeys.MOVE_EVERYONE ||
			key === RowKeys.DISCONNECT_EVERYONE ||
			key === RowKeys.MUTE_EVERYONE ||
			key === RowKeys.UNMUTE_EVERYONE ||
			key === RowKeys.DEAFEN_EVERYONE ||
			key === RowKeys.UNDEAFEN_EVERYONE ||
			key.startsWith('valenced-')
		) {
			return true
		}
	}
	if (
		isValidElement(node) &&
		(node as ReactElement).type === ChannelVoiceActionGroup
	)
		return true
	return false
}

export function isVoiceUtilsNode(node: unknown): boolean {
	return isVoiceUtilsGroup(node)
}

export function hasVoiceUtilsGroup(node: unknown, depth = 0): boolean {
	if (!node || typeof node !== 'object' || depth > 15) return false
	if (Array.isArray(node)) {
		return node.some(child => hasVoiceUtilsGroup(child, depth + 1))
	}
	if (!isValidElement(node)) return false
	if (isVoiceUtilsNode(node)) return true
	const props = (node as ReactElement).props as
		| { children?: unknown }
		| undefined
	return hasVoiceUtilsGroup(props?.children, depth + 1)
}

export function isActionSheetComponent(type: unknown): boolean {
	if (!type) return false
	try {
		if (type === Design.ActionSheet) return true
	} catch {}
	if (typeof type === 'function' || typeof type === 'object') {
		const t = type as {
			name?: string
			displayName?: string
			render?: { name?: string; displayName?: string }
		}
		if (t.name === 'ActionSheet' || t.displayName === 'ActionSheet') return true
		if (
			t.render &&
			(t.render.name === 'ActionSheet' ||
				t.render.displayName === 'ActionSheet')
		)
			return true
	}
	return false
}

export function isRowOrGroup(node: unknown): boolean {
	if (!node || typeof node !== 'object') return false
	const n = node as { type?: unknown; props?: Record<string, unknown> }
	try {
		if (n.type === Design.ActionSheetRow || n.type === Design.TableRow)
			return true
		if (
			n.type === Design.ActionSheetRow?.Group ||
			n.type === Design.TableRowGroup
		)
			return true
	} catch {}
	if (
		n.props &&
		(typeof n.props.label === 'string' || typeof n.props.onPress === 'function')
	)
		return true
	if (typeof n.type === 'string' || n.type instanceof String) {
		const str = String(n.type)
		if (str.includes('ActionSheetRow') || str.includes('TableRow')) {
			return true
		}
	}
	if (typeof n.type === 'function' || typeof n.type === 'object') {
		const t = n.type as { name?: string; displayName?: string }
		if (
			t.name === 'ActionSheetRow' ||
			t.displayName === 'ActionSheetRow' ||
			t.name === 'ActionSheetRowGroup' ||
			t.displayName === 'ActionSheetRowGroup' ||
			t.name === 'TableRow' ||
			t.displayName === 'TableRow' ||
			t.name === 'TableRowGroup' ||
			t.displayName === 'TableRowGroup'
		) {
			return true
		}
	}
	return false
}

function injectIntoRowContainer(
	node: SheetElement,
	group: ReactNode,
	depth = 0,
): SheetElement | null {
	if (!node || !isValidElement(node) || depth > 15) return null
	if (hasVoiceUtilsGroup(node)) return node
	const props = node.props as { children?: unknown; [key: string]: unknown }
	if (!props) return null

	const children = props.children
	if (Array.isArray(children)) {
		if (children.some(child => hasVoiceUtilsGroup(child))) {
			return node
		}
		const firstRowIndex = children.findIndex(isRowOrGroup)
		if (firstRowIndex !== -1) {
			const newChildren = [
				...children.slice(0, firstRowIndex),
				group,
				...children.slice(firstRowIndex),
			]
			return cloneElement(node, {
				...props,
				children: newChildren,
			})
		}

		for (let i = 0; i < children.length; i++) {
			const child = children[i]
			if (isValidElement(child)) {
				const injectedChild = injectIntoRowContainer(
					child as SheetElement,
					group,
					depth + 1,
				)
				if (injectedChild && injectedChild !== child) {
					const newChildren = [...children]
					newChildren[i] = injectedChild
					return cloneElement(node, {
						...props,
						children: newChildren,
					})
				}
			}
		}
	} else if (isValidElement(children)) {
		if (hasVoiceUtilsGroup(children)) {
			return node
		}
		if (isRowOrGroup(children)) {
			return cloneElement(node, {
				...props,
				children: [group, children],
			})
		}
		const injectedChild = injectIntoRowContainer(
			children as SheetElement,
			group,
			depth + 1,
		)
		if (injectedChild && injectedChild !== children) {
			return cloneElement(node, {
				...props,
				children: injectedChild,
			})
		}
	}

	return null
}

export function injectActionGroup(
	tree: SheetElement,
	group: ReactNode,
): SheetElement {
	if (!tree || !isValidElement(tree) || !group) return tree
	if (hasVoiceUtilsGroup(tree)) return tree

	const injected = injectIntoRowContainer(tree, group)
	if (injected) return injected

	const props = tree.props as { children?: unknown; [key: string]: unknown }
	const children = [props?.children].flat().filter(Boolean)
	if (children.some(child => hasVoiceUtilsGroup(child))) {
		return tree
	}
	return cloneElement(tree, {
		...props,
		children: [group, ...children],
	})
}

const closeAndRun = (action: () => void, onClose?: () => void) => () => {
	if (onClose) {
		onClose()
	} else {
		ActionSheetActionCreators.hideActionSheet()
	}
	action()
}

function openDisconnectConfirmation(
	channel: ChannelRecord,
	guildId: string,
	memberIds: string[],
): void {
	const { AlertActionButton, AlertModal } = Design
	const actionButtons = [
		<AlertActionButton
			key="disconnect"
			text={`Disconnect ${memberIds.length} Members`}
			variant="destructive"
			onPress={async () => {
				AlertActionCreators.dismissAlert(ModalKeys.DISCONNECT_CONFIRM)
				const count = await disconnectMembers(guildId, memberIds)
				showToast(`Disconnected ${count} members`, 'disconnect-success')
			}}
		/>,
		<AlertActionButton
			key="cancel"
			text="Cancel"
			variant="secondary"
			onPress={() =>
				AlertActionCreators.dismissAlert(ModalKeys.DISCONNECT_CONFIRM)
			}
		/>,
	]

	AlertActionCreators.openAlert(
		ModalKeys.DISCONNECT_CONFIRM,
		<AlertModal
			title="Disconnect Everyone"
			content={`Are you sure you want to disconnect all ${memberIds.length} members from #${channel.name ?? 'channel'}?`}
			actions={actionButtons}
		/>,
	)
}

function openMoveConfirmation(
	sourceChannel: ChannelRecord,
	targetChannel: ChannelRecord,
	guildId: string,
	memberIds: string[],
): void {
	const { AlertActionButton, AlertModal } = Design
	const fromName = sourceChannel.name
		? `#${sourceChannel.name}`
		: 'this channel'
	const toName = targetChannel.name
		? `#${targetChannel.name}`
		: 'destination channel'

	const actionButtons = [
		<AlertActionButton
			key="move"
			text={`Move ${memberIds.length} Members`}
			variant="primary"
			onPress={async () => {
				AlertActionCreators.dismissAlert(ModalKeys.MOVE_CONFIRM)
				const count = await moveMembers(guildId, targetChannel.id, memberIds)
				showToast(`Moved ${count} members to ${toName}`, 'move-success')
			}}
		/>,
		<AlertActionButton
			key="cancel"
			text="Cancel"
			variant="secondary"
			onPress={() => AlertActionCreators.dismissAlert(ModalKeys.MOVE_CONFIRM)}
		/>,
	]

	AlertActionCreators.openAlert(
		ModalKeys.MOVE_CONFIRM,
		<AlertModal
			title="Move Everyone"
			content={`Are you sure you want to move all ${memberIds.length} members from ${fromName} to ${toName}?`}
			actions={actionButtons}
		/>,
	)
}

function renderRowIcon(name: string): ReactElement | undefined {
	const RowIcon =
		(
			Design.ActionSheetRow as unknown as {
				Icon?: React.ComponentType<{
					IconComponent?: unknown
					source?: number
				}>
			}
		)?.Icon ??
		(
			Design.TableRow as unknown as {
				Icon?: React.ComponentType<{
					IconComponent?: unknown
					source?: number
				}>
			}
		)?.Icon

	const iconComp = lookupGeneratedIconComponent(name)
	if (RowIcon) {
		if (iconComp) {
			return <RowIcon IconComponent={iconComp} />
		}
		const id = getAssetIdByName(name)
		if (typeof id === 'number') {
			return <RowIcon source={id} />
		}
	}
	return undefined
}

function ChannelVoiceActionGroup({
	channel,
	onClose,
	jsonStorage,
}: {
	channel: ChannelRecord
	onClose?: () => void
	jsonStorage: JsonStorage<Settings>
}): ReactElement | null {
	if (!isVoiceChannel(channel)) return null

	const rawSettings =
		typeof jsonStorage?.use === 'function'
			? jsonStorage.use()
			: jsonStorage?.cache
	const settings: Settings = {
		...DefaultSettings,
		...(rawSettings as Partial<Settings> | undefined),
	}
	const enableStatus = settings.enableVoiceStatus
	const enableBulk = settings.enableBulkActions
	const confirmDisconnect = settings.confirmDisconnect
	const confirmMove = settings.confirmMove

	const canStatus = enableStatus && canSetVoiceStatus(channel)
	const canMove = enableBulk && canMoveMembers(channel)
	const canMute = enableBulk && canMuteMembers(channel)
	const canDeafen = enableBulk && canDeafenMembers(channel)

	if (!canStatus && !canMove && !canMute && !canDeafen) {
		return null
	}

	const guildId = channel.guild_id ?? channel.guildId ?? ''
	const members = getVoiceChannelMembers(channel.id)
	const memberIds = members
		.map(m => m.userId)
		.filter((id): id is string => typeof id === 'string')
	const currentStatus = getChannelStatus(channel)
	const hasMembers = memberIds.length > 0

	const ActionSheetRowGroup =
		Design.ActionSheetRow?.Group ?? Design.TableRowGroup
	const ActionSheetRow = Design.ActionSheetRow ?? Design.TableRow

	if (!ActionSheetRow) return null

	const rows: ReactElement[] = []

	if (canStatus) {
		rows.push(
			<ActionSheetRow
				key={RowKeys.VOICE_STATUS}
				label={currentStatus ? 'Edit Voice Status' : 'Set Voice Status'}
				subLabel={currentStatus || undefined}
				icon={renderRowIcon('PencilIcon')}
				onPress={closeAndRun(() => {
					openVoiceStatusModal({
						channel,
						initialStatus: currentStatus,
					})
				}, onClose)}
			/>,
		)
	}

	if (canMove && guildId && hasMembers) {
		rows.push(
			<ActionSheetRow
				key={RowKeys.MOVE_EVERYONE}
				label="Move Everyone"
				subLabel={`${members.length} members`}
				icon={renderRowIcon('ArrowsUpDownIcon')}
				onPress={closeAndRun(() => {
					const voiceChannels = getGuildVoiceChannels(guildId)
					const targets = voiceChannels.filter(c => c.id !== channel.id)
					if (targets.length === 0) {
						showToast(
							'No other voice channels in this server',
							'move-no-targets',
						)
						return
					}
					openChannelPickerMove({
						guildId,
						memberIds,
						targetChannels: targets,
						onSelectChannel: (selected: ChannelRecord) => {
							if (confirmMove) {
								openMoveConfirmation(channel, selected, guildId, memberIds)
							} else {
								void moveMembers(guildId, selected.id, memberIds).then(
									count => {
										showToast(
											`Moved ${count} members to #${selected.name ?? 'channel'}`,
											'move-success',
										)
									},
								)
							}
						},
					})
				}, onClose)}
			/>,
		)

		rows.push(
			<ActionSheetRow
				key={RowKeys.DISCONNECT_EVERYONE}
				label="Disconnect Everyone"
				subLabel={`${members.length} members`}
				icon={renderRowIcon('DoorExitIcon')}
				onPress={closeAndRun(() => {
					if (confirmDisconnect) {
						openDisconnectConfirmation(channel, guildId, memberIds)
					} else {
						disconnectMembers(guildId, memberIds).then(count => {
							showToast(`Disconnected ${count} members`, 'disconnect-success')
						})
					}
				}, onClose)}
			/>,
		)
	}

	if (canMute && guildId && hasMembers) {
		const unmuted = members.filter(m => !m.mute)
		const muted = members.filter(m => m.mute)

		if (unmuted.length > 0) {
			rows.push(
				<ActionSheetRow
					key={RowKeys.MUTE_EVERYONE}
					label="Server Mute Everyone"
					subLabel={`${unmuted.length} unmuted`}
					icon={renderRowIcon('MicrophoneSlashIcon')}
					onPress={closeAndRun(() => {
						muteMembers(guildId, memberIds, true).then(count => {
							showToast(`Server muted ${count} members`, 'mute-success')
						})
					}, onClose)}
				/>,
			)
		}

		if (muted.length > 0) {
			rows.push(
				<ActionSheetRow
					key={RowKeys.UNMUTE_EVERYONE}
					label="Server Unmute Everyone"
					subLabel={`${muted.length} muted`}
					icon={renderRowIcon('MicrophoneIcon')}
					onPress={closeAndRun(() => {
						muteMembers(guildId, memberIds, false).then(count => {
							showToast(`Server unmuted ${count} members`, 'unmute-success')
						})
					}, onClose)}
				/>,
			)
		}
	}

	if (canDeafen && guildId && hasMembers) {
		const undeafened = members.filter(m => !m.deaf)
		const deafened = members.filter(m => m.deaf)

		if (undeafened.length > 0) {
			rows.push(
				<ActionSheetRow
					key={RowKeys.DEAFEN_EVERYONE}
					label="Server Deafen Everyone"
					subLabel={`${undeafened.length} undeafened`}
					icon={renderRowIcon('HeadphonesSlashIcon')}
					onPress={closeAndRun(() => {
						deafenMembers(guildId, memberIds, true).then(count => {
							showToast(`Server deafened ${count} members`, 'deafen-success')
						})
					}, onClose)}
				/>,
			)
		}

		if (deafened.length > 0) {
			rows.push(
				<ActionSheetRow
					key={RowKeys.UNDEAFEN_EVERYONE}
					label="Server Undeafen Everyone"
					subLabel={`${deafened.length} deafened`}
					icon={renderRowIcon('HeadphonesIcon')}
					onPress={closeAndRun(() => {
						deafenMembers(guildId, memberIds, false).then(count => {
							showToast(
								`Server undeafened ${count} members`,
								'undeafen-success',
							)
						})
					}, onClose)}
				/>,
			)
		}
	}

	if (rows.length === 0) return null

	if (ActionSheetRowGroup) {
		return (
			<ActionSheetRowGroup hasIcons key="valenced-voice-utils-group">
				{rows}
			</ActionSheetRowGroup>
		)
	}

	return <View key="valenced-voice-utils-group">{rows}</View>
}

const PATCHED_MARKER = Symbol.for('valenced.voice-utils.patched')
const WRAPPER_MARKER = Symbol.for('valenced.voice-utils.wrapper')

export function patchChannelActionSheet(
	cleanup: (...fns: Array<() => void>) => void,
	jsonStorage: JsonStorage<Settings>,
): void {
	const patchedModules = new WeakSet<object>()
	const unpatches: Array<() => void> = []

	const wrappers = new WeakMap<
		(props: Record<string, unknown>) => SheetElement | null,
		(props: Record<string, unknown>) => SheetElement | null
	>()

	const wrapInner = (
		Inner: (props: Record<string, unknown>) => SheetElement | null,
	): ((props: Record<string, unknown>) => SheetElement | null) => {
		const innerRecord = Inner as unknown as Record<symbol, boolean>
		if (innerRecord[WRAPPER_MARKER]) return Inner

		let Wrapper = wrappers.get(Inner)
		if (!Wrapper) {
			Wrapper = props => {
				const tree = Inner(props)
				if (!tree || !isValidElement(tree)) return tree
				if (hasVoiceUtilsGroup(tree)) return tree

				try {
					const channel = getChannelRecord(props)
					if (channel && isVoiceChannel(channel)) {
						return injectActionGroup(
							tree,
							<ChannelVoiceActionGroup
								key="valenced-voice-utils-group"
								channel={channel}
								onClose={props.onClose as (() => void) | undefined}
								jsonStorage={jsonStorage}
							/>,
						)
					}
				} catch {}

				return tree
			}
			const wrapperRecord = Wrapper as unknown as Record<symbol, boolean>
			wrapperRecord[WRAPPER_MARKER] = true
			wrappers.set(Inner, Wrapper)
		}
		return Wrapper
	}

	const applyPatchToModule = (mod: unknown) => {
		if (!mod || typeof mod !== 'object') return
		if (patchedModules.has(mod)) return
		const targetMod = mod as ActionSheetModule
		if (typeof targetMod.default !== 'function') return
		const targetRecord = targetMod as unknown as Record<symbol, boolean>
		if (targetRecord[PATCHED_MARKER]) return
		const defaultRecord = targetMod.default as unknown as Record<
			symbol,
			boolean
		>
		if (defaultRecord[PATCHED_MARKER]) return
		if (patchedModules.has(targetMod.default)) return

		patchedModules.add(mod)
		patchedModules.add(targetMod.default)
		targetRecord[PATCHED_MARKER] = true
		defaultRecord[PATCHED_MARKER] = true

		const unpatch = instead(targetMod, 'default', (args, orig) => {
			const tree = Reflect.apply(orig, targetMod, args) as SheetElement | null
			if (!tree || typeof tree !== 'object' || !isValidElement(tree))
				return tree

			const Inner = tree.type
			if (typeof Inner === 'function' && !isActionSheetComponent(Inner)) {
				return createElement(
					wrapInner(
						Inner as (props: Record<string, unknown>) => SheetElement | null,
					),
					{
						...tree.props,
						key: tree.key,
					},
				)
			}

			if (hasVoiceUtilsGroup(tree)) return tree

			try {
				const channel = getChannelRecord(args[0])
				if (channel && isVoiceChannel(channel)) {
					return injectActionGroup(
						tree,
						<ChannelVoiceActionGroup
							key="valenced-voice-utils-group"
							channel={channel}
							onClose={
								(args[0] as Record<string, unknown>)?.onClose as
									| (() => void)
									| undefined
							}
							jsonStorage={jsonStorage}
						/>,
					)
				}
			} catch {}

			return tree
		})

		unpatches.push(() => {
			delete targetRecord[PATCHED_MARKER]
			delete defaultRecord[PATCHED_MARKER]
			try {
				unpatch()
			} catch {}
		})
	}

	try {
		const unsubscribeNamed = getModules(
			withName<ActionSheetModule>('ChannelLongPressActionSheet'),
			mod => {
				applyPatchToModule(mod)
			},
			{ returnNamespace: true },
		)
		unpatches.push(unsubscribeNamed)
	} catch {}

	try {
		const unpatchOpenLazy = before(
			ActionSheetActionCreators,
			'openLazy',
			args => {
				const name = args[1]
				if (typeof name === 'string' && name.includes('ChannelLongPress')) {
					const [mod] = lookupModule(
						withName<ActionSheetModule>('ChannelLongPressActionSheet'),
						{ returnNamespace: true },
					)
					if (mod) applyPatchToModule(mod)
					const [modPath] = lookupModuleWithImportedPath<ActionSheetModule>(
						CHANNEL_LONG_PRESS_IMPORTED_PATH,
					)
					if (modPath) applyPatchToModule(modPath)
				}
				return args
			},
		)
		unpatches.push(unpatchOpenLazy)
	} catch {}

	const [initialNamed, initialNamedId] = lookupModule(
		withName<ActionSheetModule>('ChannelLongPressActionSheet'),
		{ returnNamespace: true },
	)
	if (initialNamedId !== undefined && initialNamed) {
		applyPatchToModule(initialNamed)
	}

	const [initialModule, initialId] =
		lookupModuleWithImportedPath<ActionSheetModule>(
			CHANNEL_LONG_PRESS_IMPORTED_PATH,
		)
	if (initialId !== undefined && initialModule) {
		applyPatchToModule(initialModule)
	}

	const unsubscribePath = getModuleWithImportedPath<ActionSheetModule>(
		CHANNEL_LONG_PRESS_IMPORTED_PATH,
		mod => {
			applyPatchToModule(mod)
		},
	)
	unpatches.push(unsubscribePath)

	cleanup(() => {
		for (const u of unpatches) {
			try {
				u()
			} catch {}
		}
	})
}
