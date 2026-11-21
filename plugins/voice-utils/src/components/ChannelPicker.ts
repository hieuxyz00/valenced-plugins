import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Stores } from '@valenced/discord/flux'
import {
	getModuleWithImportedPath,
	lookupModuleWithImportedPath,
} from '@valenced/discord/utils/modules/finders'
import { getModules, lookupModule } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { CHANNEL_PICKER_IMPORTED_PATH } from '../constants'
import { showToast } from '../utils/toast'
import { moveMembers } from '../utils/voiceApi'
import type { FC } from 'react'
import type { ChannelRecord } from '../types'

interface ChannelPickerActionSheetProps {
	guild?: unknown
	header?: { title: string }
	channels: ChannelRecord[]
	onSelect: (channel: ChannelRecord) => void
	selectedChannel?: ChannelRecord | null
}

interface ChannelPickerModule {
	default: FC<ChannelPickerActionSheetProps>
}

interface GuildStoreExports {
	getGuild(guildId: string): unknown
}

let cachedChannelPickerModule: ChannelPickerModule | undefined

try {
	getModuleWithImportedPath<ChannelPickerModule>(
		CHANNEL_PICKER_IMPORTED_PATH,
		mod => {
			if (mod) {
				const target = mod as
					| { default?: FC<ChannelPickerActionSheetProps> }
					| FC<ChannelPickerActionSheetProps>
				if (
					typeof (target as { default?: FC<ChannelPickerActionSheetProps> })
						.default === 'function'
				) {
					cachedChannelPickerModule = target as ChannelPickerModule
				} else if (typeof target === 'function') {
					cachedChannelPickerModule = { default: target }
				}
			}
		},
	)
} catch {}

try {
	getModules(
		withName<ChannelPickerModule | FC<ChannelPickerActionSheetProps>>(
			'ChannelPickerActionSheet',
		),
		mod => {
			if (mod) {
				const target = mod as
					| { default?: FC<ChannelPickerActionSheetProps> }
					| FC<ChannelPickerActionSheetProps>
				if (
					typeof (target as { default?: FC<ChannelPickerActionSheetProps> })
						.default === 'function'
				) {
					cachedChannelPickerModule = target as ChannelPickerModule
				} else if (typeof target === 'function') {
					cachedChannelPickerModule = { default: target }
				}
			}
		},
		{ returnNamespace: true },
	)
} catch {}

export function getChannelPickerModule(): ChannelPickerModule | undefined {
	if (cachedChannelPickerModule?.default) {
		return cachedChannelPickerModule
	}

	try {
		const [mod, id] = lookupModuleWithImportedPath<ChannelPickerModule>(
			CHANNEL_PICKER_IMPORTED_PATH,
		)
		if (id !== undefined) {
			const target = mod?.default
				? mod
				: typeof __r === 'function'
					? (__r(id) as ChannelPickerModule | FC<ChannelPickerActionSheetProps>)
					: undefined
			if (target) {
				if (
					typeof (target as { default?: FC<ChannelPickerActionSheetProps> })
						.default === 'function'
				) {
					cachedChannelPickerModule = target as ChannelPickerModule
					return cachedChannelPickerModule
				}
				if (typeof target === 'function') {
					cachedChannelPickerModule = { default: target }
					return cachedChannelPickerModule
				}
			}
		}
	} catch {}

	try {
		const [namedMod, namedId] = lookupModule(
			withName<ChannelPickerModule | FC<ChannelPickerActionSheetProps>>(
				'ChannelPickerActionSheet',
			),
		)
		if (namedId !== undefined && namedMod) {
			const target = namedMod as
				| { default?: FC<ChannelPickerActionSheetProps> }
				| FC<ChannelPickerActionSheetProps>
			if (
				typeof (target as { default?: FC<ChannelPickerActionSheetProps> })
					.default === 'function'
			) {
				cachedChannelPickerModule = target as ChannelPickerModule
				return cachedChannelPickerModule
			}
			if (typeof target === 'function') {
				cachedChannelPickerModule = { default: target }
				return cachedChannelPickerModule
			}
		}
	} catch {}

	if (typeof __r === 'function') {
		try {
			const fallback = __r(11807) as
				| ChannelPickerModule
				| FC<ChannelPickerActionSheetProps>
				| undefined
			if (fallback) {
				const target = fallback as
					| { default?: FC<ChannelPickerActionSheetProps> }
					| FC<ChannelPickerActionSheetProps>
				if (
					typeof (target as { default?: FC<ChannelPickerActionSheetProps> })
						.default === 'function'
				) {
					cachedChannelPickerModule = target as ChannelPickerModule
					return cachedChannelPickerModule
				}
				if (typeof target === 'function') {
					cachedChannelPickerModule = { default: target }
					return cachedChannelPickerModule
				}
			}
		} catch {}
	}

	return undefined
}

export interface OpenChannelPickerMoveOptions {
	guildId: string
	memberIds: string[]
	targetChannels: ChannelRecord[]
	onSelectChannel?: (selected: ChannelRecord) => void
}

export function openChannelPickerMove({
	guildId,
	memberIds,
	targetChannels,
	onSelectChannel,
}: OpenChannelPickerMoveOptions): void {
	if (targetChannels.length === 0) {
		showToast('No other voice channels available', 'move-empty')
		return
	}

	const pickerMod = getChannelPickerModule()
	if (!pickerMod?.default) {
		showToast('Channel picker unavailable', 'move-picker-error')
		return
	}

	const guildStore = Stores.GuildStore as unknown as
		| GuildStoreExports
		| undefined
	const guild = guildStore?.getGuild?.(guildId)

	ActionSheetActionCreators.openLazy(
		Promise.resolve(pickerMod),
		'ChannelPicker',
		{
			guild,
			header: { title: 'Move Everyone' },
			channels: targetChannels,
			selectedChannel: null,
			onSelect: async (selected: ChannelRecord) => {
				ActionSheetActionCreators.hideActionSheet()
				if (onSelectChannel) {
					onSelectChannel(selected)
					return
				}
				const count = await moveMembers(guildId, selected.id, memberIds)
				showToast(
					`Moved ${count} members to #${selected.name ?? 'channel'}`,
					'move-success',
				)
			},
		},
		'replaceTopSheet',
	)
}
