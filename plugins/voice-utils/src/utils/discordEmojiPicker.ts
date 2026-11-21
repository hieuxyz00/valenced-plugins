import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Stores } from '@valenced/discord/flux'
import { lookupModuleWithImportedPath } from '@valenced/discord/utils/modules/finders'
import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import {
	EMOJI_PICKER_IMPORTED_PATH,
	EXPRESSION_PICKER_IMPORTED_PATH,
} from '../constants'
import type { HieuxyzApi } from '../../../lib/src/index'

export const EmojiIntention = {
	REACTION: 0,
	STATUS: 1,
	COMMUNITY_CONTENT: 2,
	CHAT: 3,
	GUILD_STICKER_RELATED_EMOJI: 4,
	GUILD_ROLE_BENEFIT_EMOJI: 5,
	SOUNDBOARD: 6,
	VOICE_CHANNEL_TOPIC: 7,
	GIFT: 8,
	AUTO_SUGGESTION: 9,
	POLLS: 10,
	PROFILE: 11,
	GUILD_PROFILE: 12,
	DEFAULT_REACT_EMOJI: 13,
	NO_CUSTOM_EMOJI: 14,
	TYPING_INDICATOR: 15,
} as const

export interface DiscordEmojiPickerOptions {
	onPressEmoji?: (emoji: unknown, close?: boolean) => void
	onSelectEmoji?: (emoji: unknown) => void
	onSelect?: (emoji: unknown) => void
	onPress?: (emoji: unknown) => void
	channel?: { id: string; guild_id?: string | null; guildId?: string | null }
	guildId?: string | null
	pickerIntention?: number
	emojiPickerIntention?: number
	closeOnSelect?: boolean
	startExpanded?: boolean
	onlyCurrentGuild?: boolean
	onInvalidGuildEmoji?: () => void
	onClose?: () => void
	activeViewType?: string
	viewTypes?: string[]
}

interface EmojiPickerModule {
	openEmojiPickerActionSheet?: (
		options: DiscordEmojiPickerOptions,
		stackingBehavior?: 'stack' | 'replaceTopSheet' | 'replaceAll',
	) => void
	EMOJI_PICKER_ACTION_SHEET_KEY?: string
}

interface ExpressionPickerModule {
	openExpressionPickerActionSheet?: (
		options: DiscordEmojiPickerOptions,
		stackingBehavior?: 'stack' | 'replaceTopSheet' | 'replaceAll',
	) => void
	EXPRESSION_PICKER_ACTION_SHEET_KEY?: string
}

interface EmojiRecord {
	id?: string
	name?: string
	animated?: boolean
	surrogates?: string
}

interface EmojiStoreExports {
	getUsableGuildEmoji?: (guildId: string) => EmojiRecord[]
	getGuildEmoji?: (guildId: string) => EmojiRecord[]
}

export function getHieuxyzLib(): HieuxyzApi | undefined {
	try {
		const g = globalThis as unknown as { valenced?: { hieuxyz?: HieuxyzApi } }
		if (g.valenced?.hieuxyz) return g.valenced.hieuxyz
	} catch {}
	return undefined
}

let cachedEmojiPickerModule: EmojiPickerModule | undefined

export function getEmojiPickerModule(): EmojiPickerModule | undefined {
	if (cachedEmojiPickerModule?.openEmojiPickerActionSheet) {
		return cachedEmojiPickerModule
	}

	try {
		const [pathMod, pathId] = lookupModuleWithImportedPath<EmojiPickerModule>(
			EMOJI_PICKER_IMPORTED_PATH,
		)
		if (pathId !== undefined) {
			const mod = pathMod?.openEmojiPickerActionSheet
				? pathMod
				: typeof __r === 'function'
					? (__r(pathId) as EmojiPickerModule)
					: undefined
			if (mod?.openEmojiPickerActionSheet) {
				cachedEmojiPickerModule = mod
				return mod
			}
		}
	} catch {}

	try {
		const [mod] = lookupModule(
			withProps<EmojiPickerModule>('openEmojiPickerActionSheet'),
		)
		if (mod?.openEmojiPickerActionSheet) {
			cachedEmojiPickerModule = mod
			return mod
		}
	} catch {}

	try {
		const [keyMod] = lookupModule(
			withProps<EmojiPickerModule>('EMOJI_PICKER_ACTION_SHEET_KEY'),
		)
		if (keyMod?.openEmojiPickerActionSheet) {
			cachedEmojiPickerModule = keyMod
			return keyMod
		}
	} catch {}

	if (typeof __r === 'function') {
		try {
			const fallback = __r(9824) as EmojiPickerModule
			if (fallback?.openEmojiPickerActionSheet) {
				cachedEmojiPickerModule = fallback
				return fallback
			}
		} catch {}
	}

	return undefined
}

export function getExpressionPickerModule():
	| ExpressionPickerModule
	| undefined {
	try {
		const [pathMod, pathId] =
			lookupModuleWithImportedPath<ExpressionPickerModule>(
				EXPRESSION_PICKER_IMPORTED_PATH,
			)
		if (pathId !== undefined) {
			const mod = pathMod?.openExpressionPickerActionSheet
				? pathMod
				: typeof __r === 'function'
					? (__r(pathId) as ExpressionPickerModule)
					: undefined
			if (mod?.openExpressionPickerActionSheet) return mod
		}
	} catch {}

	try {
		const [mod] = lookupModule(
			withProps<ExpressionPickerModule>('openExpressionPickerActionSheet'),
		)
		if (mod?.openExpressionPickerActionSheet) return mod
	} catch {}

	return undefined
}

export function extractEmoji(payload: unknown): unknown {
	const lib = getHieuxyzLib()
	if (lib?.extractEmoji) {
		return lib.extractEmoji(payload)
	}
	if (!payload) return null
	if (typeof payload === 'object') {
		const obj = payload as Record<string, unknown>
		if (obj.emoji) return extractEmoji(obj.emoji)
		if (obj.item) return extractEmoji(obj.item)
		if (obj.data) return extractEmoji(obj.data)
		if (obj.emojiObject) return extractEmoji(obj.emojiObject)
	}
	return payload
}

export function formatEmoji(raw: unknown): string {
	const lib = getHieuxyzLib()
	if (lib?.formatEmoji) {
		return lib.formatEmoji(raw)
	}
	if (!raw) return ''
	const emoji = extractEmoji(raw)
	if (!emoji) return ''

	if (typeof emoji === 'string') {
		return emoji
	}

	if (typeof emoji === 'object' && emoji !== null) {
		const obj = emoji as Record<string, unknown>

		if (obj.id) {
			const name = typeof obj.name === 'string' && obj.name ? obj.name : 'emoji'
			return obj.animated ? `<a:${name}:${obj.id}>` : `<:${name}:${obj.id}>`
		}

		if (typeof obj.surrogates === 'string' && obj.surrogates) {
			return obj.surrogates
		}
		if (typeof obj.surrogate === 'string' && obj.surrogate) {
			return obj.surrogate
		}
		if (
			typeof obj.optionallyDiverseSequence === 'string' &&
			obj.optionallyDiverseSequence
		) {
			return obj.optionallyDiverseSequence
		}
		if (typeof obj.unicode === 'string' && obj.unicode) {
			return obj.unicode
		}
		if (typeof obj.char === 'string' && obj.char) {
			return obj.char
		}
		if (typeof obj.value === 'string' && obj.value) {
			return formatEmoji(obj.value)
		}

		if (obj.emojiObject && typeof obj.emojiObject === 'object') {
			const sub = obj.emojiObject as Record<string, unknown>
			if (typeof sub.surrogates === 'string' && sub.surrogates) {
				return sub.surrogates
			}
		}

		if (typeof obj.name === 'string' && obj.name) {
			return obj.name.replace(/^:|:$/g, '')
		}
		if (Array.isArray(obj.names) && typeof obj.names[0] === 'string') {
			return obj.names[0].replace(/^:|:$/g, '')
		}
	}
	return ''
}

export function isGuildOrUnicodeEmoji(
	emoji: unknown,
	guildId?: string | null,
): boolean {
	const lib = getHieuxyzLib()
	if (lib?.isGuildOrUnicodeEmoji) {
		return lib.isGuildOrUnicodeEmoji(emoji, guildId)
	}
	const extracted = extractEmoji(emoji)
	if (!extracted) return false
	if (typeof extracted === 'string') return true
	if (typeof extracted === 'object' && extracted !== null) {
		const obj = extracted as Record<string, unknown>
		if (!obj.id) return true
		if (!guildId) return true
		try {
			const store = Stores.EmojiStore as unknown as
				| EmojiStoreExports
				| undefined
			if (store && typeof store.getUsableGuildEmoji === 'function') {
				const guildEmojis = store.getUsableGuildEmoji(guildId)
				if (Array.isArray(guildEmojis)) {
					return guildEmojis.some(e => e.id === obj.id)
				}
			}
			if (store && typeof store.getGuildEmoji === 'function') {
				const allGuildEmojis = store.getGuildEmoji(guildId)
				if (Array.isArray(allGuildEmojis)) {
					return allGuildEmojis.some(e => e.id === obj.id)
				}
			}
		} catch {}
		return false
	}
	return true
}

interface PatchedActionSheetActionCreators {
	__multiEmojiPatched?: boolean
}

let activeEmojiPickerUnpatch: (() => void) | undefined
let isSelectingEmoji = false
let selectEmojiTimeout: ReturnType<typeof setTimeout> | undefined

export function cleanupEmojiPickerPatch(): void {
	const lib = getHieuxyzLib()
	if (
		lib &&
		typeof (lib as unknown as { cleanupEmojiPickerPatch?: () => void })
			.cleanupEmojiPickerPatch === 'function'
	) {
		try {
			;(
				lib as unknown as { cleanupEmojiPickerPatch: () => void }
			).cleanupEmojiPickerPatch()
		} catch {}
	}
	if (selectEmojiTimeout) {
		clearTimeout(selectEmojiTimeout)
		selectEmojiTimeout = undefined
	}
	isSelectingEmoji = false
	if (activeEmojiPickerUnpatch) {
		try {
			activeEmojiPickerUnpatch()
		} catch {}
		activeEmojiPickerUnpatch = undefined
	}
	try {
		const target =
			ActionSheetActionCreators as unknown as PatchedActionSheetActionCreators
		target.__multiEmojiPatched = undefined
	} catch {}
}

export function openDiscordEmojiPicker(
	options: DiscordEmojiPickerOptions,
	stackingBehavior: 'stack' | 'replaceTopSheet' | 'replaceAll' = 'stack',
): boolean {
	const lib = getHieuxyzLib()
	if (lib?.openDiscordEmojiPicker) {
		return lib.openDiscordEmojiPicker(options, stackingBehavior)
	}

	cleanupEmojiPickerPatch()

	const targetGuildId =
		options.guildId ?? options.channel?.guild_id ?? options.channel?.guildId

	const rawHandler =
		options.onPressEmoji ??
		options.onSelectEmoji ??
		options.onSelect ??
		options.onPress

	const shouldKeepOpen = options.closeOnSelect !== true

	if (shouldKeepOpen) {
		const target =
			ActionSheetActionCreators as unknown as PatchedActionSheetActionCreators
		if (!target.__multiEmojiPatched) {
			target.__multiEmojiPatched = true
			activeEmojiPickerUnpatch = instead(
				ActionSheetActionCreators,
				'hideActionSheet',
				(args, orig) => {
					if (isSelectingEmoji) {
						isSelectingEmoji = false
						return
					}
					const key = args[0]
					const result = orig(...args)
					if (
						key === 'ExpressionPickerActionSheet' ||
						key === 'EmojiPickerActionSheet' ||
						!key
					) {
						cleanupEmojiPickerPatch()
					}
					return result
				},
			)
		}
	}

	const wrappedHandler = rawHandler
		? (emoji: unknown, close?: boolean) => {
				if (shouldKeepOpen) {
					isSelectingEmoji = true
					if (selectEmojiTimeout) {
						clearTimeout(selectEmojiTimeout)
					}
					selectEmojiTimeout = setTimeout(() => {
						isSelectingEmoji = false
					}, 400)
				}
				if (options.onlyCurrentGuild && targetGuildId) {
					if (!isGuildOrUnicodeEmoji(emoji, targetGuildId)) {
						options.onInvalidGuildEmoji?.()
						return
					}
				}
				rawHandler(emoji, close)
			}
		: undefined

	const originalOnClose = options.onClose
	const wrappedOnClose = () => {
		cleanupEmojiPickerPatch()
		originalOnClose?.()
	}

	const intention =
		options.pickerIntention !== undefined
			? options.pickerIntention
			: options.onlyCurrentGuild
				? EmojiIntention.VOICE_CHANNEL_TOPIC
				: EmojiIntention.STATUS

	const normalizedOptions: DiscordEmojiPickerOptions = {
		...options,
		guildId: targetGuildId,
		pickerIntention: intention,
		emojiPickerIntention: intention,
		startExpanded: options.startExpanded ?? false,
		closeOnSelect: !shouldKeepOpen,
		onPressEmoji: wrappedHandler,
		onSelectEmoji: wrappedHandler,
		onSelect: wrappedHandler,
		onPress: wrappedHandler,
		onClose: wrappedOnClose,
	}

	const emojiMod = getEmojiPickerModule()
	if (emojiMod?.openEmojiPickerActionSheet) {
		emojiMod.openEmojiPickerActionSheet(normalizedOptions, stackingBehavior)
		return true
	}

	const expressionMod = getExpressionPickerModule()
	if (expressionMod?.openExpressionPickerActionSheet) {
		expressionMod.openExpressionPickerActionSheet(
			{
				...normalizedOptions,
				activeViewType: 'emoji',
				viewTypes: ['emoji'],
			},
			stackingBehavior,
		)
		return true
	}

	cleanupEmojiPickerPatch()
	return false
}
