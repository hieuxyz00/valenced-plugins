export const Permissions = {
	ADMINISTRATOR: 1n << 3n,
	MUTE_MEMBERS: 1n << 22n,
	DEAFEN_MEMBERS: 1n << 23n,
	MOVE_MEMBERS: 1n << 24n,
	SET_VOICE_CHANNEL_STATUS: 1n << 48n,
} as const

export const ChannelTypes = {
	GUILD_VOICE: 2,
	GUILD_STAGE_VOICE: 13,
} as const

export const ModalKeys = {
	VOICE_STATUS: 'valenced-voice-status-modal',
	MOVE_MEMBERS: 'valenced-move-members-modal',
	MOVE_CONFIRM: 'valenced-move-confirm-modal',
	DISCONNECT_CONFIRM: 'valenced-disconnect-confirm-modal',
} as const

export const RowKeys = {
	VOICE_STATUS: 'valenced-voice-status-row',
	DISCONNECT_EVERYONE: 'valenced-disconnect-everyone-row',
	MOVE_EVERYONE: 'valenced-move-everyone-row',
	MUTE_EVERYONE: 'valenced-mute-everyone-row',
	UNMUTE_EVERYONE: 'valenced-unmute-everyone-row',
	DEAFEN_EVERYONE: 'valenced-deafen-everyone-row',
	UNDEAFEN_EVERYONE: 'valenced-undeafen-everyone-row',
} as const

export const CHANNEL_LONG_PRESS_IMPORTED_PATH =
	'modules/channel/native/ChannelLongPressActionSheet.tsx' as const

export const CHANNEL_PICKER_IMPORTED_PATH =
	'modules/channel/native/ChannelPickerActionSheet.tsx' as const

export const EMOJI_PICKER_IMPORTED_PATH =
	'modules/emoji_picker/native/openEmojiPickerActionSheet.tsx' as const

export const EXPRESSION_PICKER_IMPORTED_PATH =
	'modules/expression_picker/native/openExpressionPickerActionSheet.tsx' as const

export const UNICODE_EMOJIS_IMPORTED_PATH =
	'modules/emojis/UnicodeEmojis.tsx' as const
