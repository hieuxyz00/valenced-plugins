import { TableRowAssetIcon } from '@valenced/components'
import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { lookupModuleWithImportedPath } from '@valenced/discord/utils/modules/finders'
import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	Image,
	Text as NativeText,
	Pressable,
	ScrollView,
	View,
} from 'react-native'
import { EMOJI_CATEGORIES } from './EmojiPicker'
import type { ComponentType } from 'react'
import type {
	NativeScrollEvent,
	NativeSyntheticEvent,
	ScrollViewProps,
	StyleProp,
	ViewStyle,
} from 'react-native'

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

export interface DiscordEmojiItem {
	type: 'guild' | 'unicode' | 'custom'
	id?: string
	name?: string
	char?: string
	animated?: boolean
	formatted: string
	uri?: string
	keywords?: string
}

export interface DiscordEmojiTab {
	id: string
	label: string
	items: readonly DiscordEmojiItem[]
}

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

export interface DiscordEmojiPickerProps {
	guildId?: string | null
	channelId?: string | null
	channel?: { id: string; guild_id?: string | null; guildId?: string | null }
	onSelectEmoji?: (payload: {
		formatted: string
		item: DiscordEmojiItem
		raw?: unknown
	}) => void
	onSelect?: (formatted: string, item?: DiscordEmojiItem) => void
	onPressEmoji?: (item: DiscordEmojiItem) => void
	showSearch?: boolean
	searchPlaceholder?: string
	height?: number
	maxHeight?: number
	onlyCurrentGuild?: boolean
	customTabs?: readonly DiscordEmojiTab[]
	allowDiscordPicker?: boolean
	pickerIntention?: number
	onOpenDiscordPicker?: () => void
	showCategories?: boolean
	defaultTabId?: string
	style?: StyleProp<ViewStyle>
	containerStyle?: StyleProp<ViewStyle>
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

let cachedBottomSheetScrollView:
	| ComponentType<
			ScrollViewProps & {
				disallowInterruption?: boolean
				ref?: unknown
			}
	  >
	| undefined

export function getBottomSheetScrollView(): ComponentType<
	ScrollViewProps & {
		disallowInterruption?: boolean
		ref?: unknown
	}
> {
	if (cachedBottomSheetScrollView) return cachedBottomSheetScrollView
	try {
		const [rngh] = lookupModule(
			withProps<{
				ScrollView: ComponentType<
					ScrollViewProps & {
						disallowInterruption?: boolean
						ref?: unknown
					}
				>
				GestureHandlerRootView: unknown
				PanGestureHandler: unknown
			}>('GestureHandlerRootView', 'PanGestureHandler'),
		)
		if (rngh?.ScrollView) {
			cachedBottomSheetScrollView = rngh.ScrollView
			return rngh.ScrollView
		}
	} catch {}
	return ScrollView
}

let cachedEmojiPickerModule: EmojiPickerModule | undefined

export function getEmojiPickerModule(): EmojiPickerModule | undefined {
	if (cachedEmojiPickerModule?.openEmojiPickerActionSheet) {
		return cachedEmojiPickerModule
	}
	try {
		const [pathMod, pathId] = lookupModuleWithImportedPath<EmojiPickerModule>(
			'modules/emoji_picker/native/openEmojiPickerActionSheet.tsx',
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
		const [modKey] = lookupModule(
			withProps<EmojiPickerModule>('EMOJI_PICKER_ACTION_SHEET_KEY'),
		)
		if (modKey?.openEmojiPickerActionSheet) {
			cachedEmojiPickerModule = modKey
			return modKey
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
				'modules/expression_picker/native/openExpressionPickerActionSheet.tsx',
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

interface DiscordUnicodeModuleExports {
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

function getDiscordUnicodeModule(): DiscordUnicodeModuleExports | undefined {
	try {
		const [propsMod] = lookupModule(withProps('convertNameToSurrogate'), {
			initialize: true,
		})
		if (propsMod) {
			return ((propsMod as unknown as Record<string, unknown>)?.default ??
				propsMod) as unknown as DiscordUnicodeModuleExports
		}
		const [pathMod, pathId] = lookupModuleWithImportedPath<
			Record<string, unknown>
		>('modules/emojis/UnicodeEmojis.tsx')
		if (pathId !== undefined && pathMod) {
			return ((pathMod as unknown as Record<string, unknown>)?.default ??
				pathMod) as unknown as DiscordUnicodeModuleExports
		}
	} catch {}
	return undefined
}

export const UNICODE_CATEGORY_LABELS: Record<string, string> = {
	people: 'Smileys',
	nature: 'Nature',
	food: 'Food',
	activity: 'Activities',
	travel: 'Travel',
	objects: 'Objects',
	symbols: 'Symbols',
	flags: 'Flags',
}

const CATEGORY_MAP_FALLBACK: Record<string, string> = {
	'Smileys & Emotion': 'people',
	'People & Body': 'people',
	'Animals & Nature': 'nature',
	'Food & Drink': 'food',
	'Activities & Sports': 'activity',
	'Travel & Places': 'travel',
	'Objects & Tech': 'objects',
	'Symbols & Hearts': 'symbols',
}

const categoryCache = new Map<string, readonly DiscordEmojiItem[]>()
let cachedUnicodeEmojis: readonly DiscordEmojiItem[] | undefined

export function getUnicodeEmojisByCategory(
	categoryId: string,
): readonly DiscordEmojiItem[] {
	const existing = categoryCache.get(categoryId)
	if (existing && existing.length > 0) return existing

	const utils = getDiscordUnicodeModule()
	if (utils && typeof utils.getByCategory === 'function') {
		const rawItems = utils.getByCategory(categoryId) ?? []
		const list: DiscordEmojiItem[] = []
		const seen = new Set<string>()

		for (const e of rawItems) {
			const char = e.surrogates || e.emojiObject?.surrogates
			if (!char || seen.has(char)) continue
			seen.add(char)
			const name = e.uniqueName || ''
			const names = e.emojiObject?.names || []
			const keywords = `${names.join(' ')} ${name} ${char}`.trim().toLowerCase()
			list.push({
				type: 'unicode',
				char,
				name,
				formatted: char,
				keywords,
			})
		}
		if (list.length > 0) {
			const frozen = Object.freeze(list)
			categoryCache.set(categoryId, frozen)
			return frozen
		}
	}

	const fallbackList: DiscordEmojiItem[] = []
	const seenFallback = new Set<string>()

	for (const cat of EMOJI_CATEGORIES) {
		const mappedId = CATEGORY_MAP_FALLBACK[cat.name] ?? 'objects'
		if (mappedId === categoryId) {
			for (const char of cat.emojis) {
				if (!seenFallback.has(char)) {
					seenFallback.add(char)
					fallbackList.push({
						type: 'unicode',
						char,
						name: cat.name,
						formatted: char,
						keywords: `${cat.name} ${char}`.toLowerCase(),
					})
				}
			}
		}
	}

	const result = Object.freeze(fallbackList)
	categoryCache.set(categoryId, result)
	return result
}

export function getDefaultUnicodeEmojis(): readonly DiscordEmojiItem[] {
	if (cachedUnicodeEmojis && cachedUnicodeEmojis.length > 0) {
		return cachedUnicodeEmojis
	}

	const utils = getDiscordUnicodeModule()
	if (utils) {
		const list: DiscordEmojiItem[] = []
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
			const keywords = `${names.join(' ')} ${name} ${char}`.trim().toLowerCase()
			list.push({
				type: 'unicode',
				char,
				name,
				formatted: char,
				keywords,
			})
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
			cachedUnicodeEmojis = Object.freeze(list)
			return cachedUnicodeEmojis
		}
	}

	const fallbackList: DiscordEmojiItem[] = []
	const seen = new Set<string>()
	for (const cat of EMOJI_CATEGORIES) {
		for (const char of cat.emojis) {
			if (!seen.has(char)) {
				seen.add(char)
				fallbackList.push({
					type: 'unicode',
					char,
					name: cat.name,
					formatted: char,
					keywords: `${cat.name} ${char}`.toLowerCase(),
				})
			}
		}
	}
	cachedUnicodeEmojis = Object.freeze(fallbackList)
	return cachedUnicodeEmojis
}

export function getGuildEmojis(
	guildId?: string | null,
): readonly DiscordEmojiItem[] {
	if (!guildId) return []
	try {
		const store = Stores.EmojiStore as unknown as EmojiStoreExports | undefined
		const list =
			store?.getUsableGuildEmoji?.(guildId) ??
			store?.getGuildEmoji?.(guildId) ??
			[]
		const result: DiscordEmojiItem[] = []
		for (const e of list) {
			if (e?.id && e?.name) {
				const ext = e.animated ? 'gif' : 'webp'
				const uri = `https://cdn.discordapp.com/emojis/${e.id}.${ext}?size=64&quality=lossless`
				const formatted = e.animated
					? `<a:${e.name}:${e.id}>`
					: `<:${e.name}:${e.id}>`
				result.push({
					type: 'guild',
					id: e.id,
					name: e.name,
					animated: Boolean(e.animated),
					formatted,
					uri,
					keywords: e.name.toLowerCase(),
				})
			}
		}
		return Object.freeze(result)
	} catch {
		return []
	}
}

const ITEM_SIZE = 38
const ITEM_GAP = 6
const ROW_HEIGHT = ITEM_SIZE + ITEM_GAP
const OVERSCAN_ROWS = 3

const EmojiGridCell = memo(
	({
		item,
		onPress,
	}: {
		item: DiscordEmojiItem
		onPress: (item: DiscordEmojiItem) => void
	}) => {
		const handlePress = useCallback(() => {
			onPress(item)
		}, [item, onPress])

		if (item.type === 'guild' || item.uri) {
			return (
				<Pressable
					hitSlop={4}
					onPress={handlePress}
					style={({ pressed }) => ({
						width: ITEM_SIZE,
						height: ITEM_SIZE,
						borderRadius: 8,
						backgroundColor: pressed
							? 'rgba(255, 255, 255, 0.2)'
							: 'transparent',
						justifyContent: 'center',
						alignItems: 'center',
						transform: [{ scale: pressed ? 0.9 : 1 }],
					})}
				>
					<Image
						source={{ uri: item.uri }}
						style={{ width: 28, height: 28 }}
						resizeMode="contain"
					/>
				</Pressable>
			)
		}

		return (
			<Pressable
				hitSlop={4}
				onPress={handlePress}
				style={({ pressed }) => ({
					width: ITEM_SIZE,
					height: ITEM_SIZE,
					borderRadius: 8,
					backgroundColor: pressed ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
					justifyContent: 'center',
					alignItems: 'center',
					transform: [{ scale: pressed ? 0.9 : 1 }],
				})}
			>
				<NativeText style={{ fontSize: 22, textAlign: 'center' }}>
					{item.char}
				</NativeText>
			</Pressable>
		)
	},
)

export function DiscordEmojiPicker({
	guildId,
	channelId,
	channel,
	onSelectEmoji,
	onSelect,
	onPressEmoji,
	showSearch = true,
	searchPlaceholder,
	height = 200,
	maxHeight,
	onlyCurrentGuild = false,
	customTabs,
	allowDiscordPicker = true,
	pickerIntention,
	onOpenDiscordPicker,
	showCategories: _showCategories = false,
	defaultTabId,
	style,
	containerStyle,
}: DiscordEmojiPickerProps) {
	const { Text, TextInput } = Design

	const targetGuildId =
		guildId ?? channel?.guild_id ?? channel?.guildId ?? undefined

	const [containerWidth, setContainerWidth] = useState(320)
	const [scrollY, setScrollY] = useState(0)
	const [searchQuery, setSearchQuery] = useState('')
	const [isSearching, setIsSearching] = useState(false)
	const scrollRef = useRef<ScrollView>(null)

	useEffect(() => {
		return () => {
			cleanupEmojiPickerPatch()
		}
	}, [])

	const guildEmojis = useMemo(() => {
		return getGuildEmojis(targetGuildId)
	}, [targetGuildId])

	const defaultUnicodeEmojis = useMemo(() => {
		return getDefaultUnicodeEmojis()
	}, [])

	const hasGuild = guildEmojis.length > 0
	const [activeTabId, setActiveTabId] = useState<string>(() => {
		if (defaultTabId) return defaultTabId
		return hasGuild ? 'server' : 'default'
	})

	const tabs = useMemo<readonly DiscordEmojiTab[]>(() => {
		const list: DiscordEmojiTab[] = []
		if (hasGuild) {
			list.push({
				id: 'server',
				label: `Server (${guildEmojis.length})`,
				items: guildEmojis,
			})
		} else {
			list.push({
				id: 'server',
				label: 'Server',
				items: [],
			})
		}
		list.push({
			id: 'default',
			label: 'Default',
			items: defaultUnicodeEmojis,
		})
		if (customTabs && customTabs.length > 0) {
			for (const tab of customTabs) {
				list.push(tab)
			}
		}
		return list
	}, [hasGuild, guildEmojis, defaultUnicodeEmojis, customTabs])

	const currentTabEmojis = useMemo(() => {
		if (activeTabId === 'server') return guildEmojis
		if (activeTabId === 'default') return defaultUnicodeEmojis
		const custom = customTabs?.find(t => t.id === activeTabId)
		return custom?.items ?? defaultUnicodeEmojis
	}, [activeTabId, guildEmojis, defaultUnicodeEmojis, customTabs])

	const allEmojisForSearch = useMemo(() => {
		if (!searchQuery.trim()) return []
		const list: DiscordEmojiItem[] = [...guildEmojis, ...defaultUnicodeEmojis]
		if (customTabs) {
			for (const tab of customTabs) {
				list.push(...tab.items)
			}
		}
		return list
	}, [searchQuery, guildEmojis, defaultUnicodeEmojis, customTabs])

	const filteredItems = useMemo<readonly DiscordEmojiItem[]>(() => {
		const q = searchQuery.trim().toLowerCase()
		if (!q) {
			return currentTabEmojis
		}
		return allEmojisForSearch.filter(item => {
			if (item.name?.toLowerCase().includes(q)) return true
			if (item.char?.includes(q)) return true
			if (item.keywords?.includes(q)) return true
			return false
		})
	}, [currentTabEmojis, allEmojisForSearch, searchQuery])

	const handleTabChange = useCallback((id: string) => {
		setActiveTabId(id)
		setScrollY(0)
		scrollRef.current?.scrollTo({ y: 0, animated: false })
	}, [])

	const handleItemPress = useCallback(
		(item: DiscordEmojiItem) => {
			onSelect?.(item.formatted, item)
			onSelectEmoji?.({ formatted: item.formatted, item, raw: item })
			onPressEmoji?.(item)
		},
		[onSelect, onSelectEmoji, onPressEmoji],
	)

	const handleToggleSearch = useCallback(() => {
		setIsSearching(prev => {
			const next = !prev
			if (!next) {
				setSearchQuery('')
				setScrollY(0)
				scrollRef.current?.scrollTo({ y: 0, animated: false })
			}
			return next
		})
	}, [])

	const handleSearchChange = useCallback((val: unknown) => {
		let text = ''
		if (typeof val === 'string') text = val
		else if (val && typeof val === 'object') {
			const obj = val as Record<string, unknown>
			if (typeof obj.text === 'string') text = obj.text
			else if (obj.nativeEvent && typeof obj.nativeEvent === 'object') {
				const ne = obj.nativeEvent as Record<string, unknown>
				if (typeof ne.text === 'string') text = ne.text
			}
		}
		setSearchQuery(text)
		setScrollY(0)
		scrollRef.current?.scrollTo({ y: 0, animated: false })
	}, [])

	const handleOpenNativePicker = useCallback(() => {
		if (onOpenDiscordPicker) {
			onOpenDiscordPicker()
			return
		}
		openDiscordEmojiPicker({
			guildId: targetGuildId,
			channel: channel
				? { id: channel.id, guildId: targetGuildId }
				: channelId
					? { id: channelId, guildId: targetGuildId }
					: undefined,
			pickerIntention:
				pickerIntention !== undefined
					? pickerIntention
					: onlyCurrentGuild
						? EmojiIntention.VOICE_CHANNEL_TOPIC
						: EmojiIntention.STATUS,
			closeOnSelect: false,
			onlyCurrentGuild,
			onPressEmoji: (raw: unknown) => {
				const formatted = formatEmoji(raw)
				if (formatted) {
					handleItemPress({
						type: 'custom',
						id: '',
						formatted,
					})
				}
			},
		})
	}, [
		onOpenDiscordPicker,
		targetGuildId,
		channel,
		channelId,
		pickerIntention,
		onlyCurrentGuild,
		handleItemPress,
	])

	const handleScroll = useCallback(
		(e: NativeSyntheticEvent<NativeScrollEvent>) => {
			setScrollY(e.nativeEvent.contentOffset.y)
		},
		[],
	)

	const effectiveHeight = maxHeight ? Math.min(height, maxHeight) : height
	const itemsPerRow = Math.max(
		4,
		Math.floor((containerWidth - 16) / ROW_HEIGHT),
	)
	const totalRows = Math.ceil(filteredItems.length / itemsPerRow)

	const startRowIndex = Math.max(
		0,
		Math.floor(scrollY / ROW_HEIGHT) - OVERSCAN_ROWS,
	)
	const visibleRowCount =
		Math.ceil(effectiveHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2
	const endRowIndex = Math.min(totalRows, startRowIndex + visibleRowCount)

	const visibleRows = useMemo(() => {
		const rows: DiscordEmojiItem[][] = []
		for (let r = startRowIndex; r < endRowIndex; r++) {
			const startIdx = r * itemsPerRow
			const row = filteredItems.slice(startIdx, startIdx + itemsPerRow)
			if (row.length > 0) rows.push(row)
		}
		return rows
	}, [filteredItems, startRowIndex, endRowIndex, itemsPerRow])

	const topSpacerHeight = startRowIndex * ROW_HEIGHT
	const bottomSpacerHeight = Math.max(0, (totalRows - endRowIndex) * ROW_HEIGHT)

	const MagnifyingGlassIcon = lookupGeneratedIconComponent(
		'MagnifyingGlassIcon',
	)
	const ScrollComponent = getBottomSheetScrollView()

	return (
		<View
			style={[
				{
					backgroundColor: 'rgba(0, 0, 0, 0.15)',
					borderRadius: 12,
					padding: 8,
				},
				containerStyle,
			]}
			onLayout={e => {
				const w = e.nativeEvent.layout.width
				if (w > 0) setContainerWidth(w)
			}}
		>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginBottom: 8,
				}}
			>
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 6,
						flexShrink: 1,
					}}
				>
					{tabs.map(tab => {
						const isSelected = tab.id === activeTabId
						return (
							<Pressable
								key={tab.id}
								onPress={() => handleTabChange(tab.id)}
								style={({ pressed }) => ({
									paddingHorizontal: 12,
									paddingVertical: 6,
									borderRadius: 14,
									backgroundColor: isSelected
										? '#5865F2'
										: pressed
											? 'rgba(255, 255, 255, 0.15)'
											: 'rgba(255, 255, 255, 0.08)',
								})}
							>
								<Text
									variant="text-xs/semibold"
									style={{
										color: isSelected ? '#FFFFFF' : '#B5BAC1',
									}}
								>
									{tab.label}
								</Text>
							</Pressable>
						)
					})}
				</View>

				{showSearch && (
					<Pressable
						onPress={handleToggleSearch}
						hitSlop={6}
						style={({ pressed }) => ({
							width: 28,
							height: 28,
							borderRadius: 14,
							justifyContent: 'center',
							alignItems: 'center',
							backgroundColor: isSearching
								? '#5865F2'
								: pressed
									? 'rgba(255, 255, 255, 0.15)'
									: 'rgba(255, 255, 255, 0.08)',
						})}
					>
						{MagnifyingGlassIcon ? (
							<MagnifyingGlassIcon
								size="xs"
								color={
									isSearching ? 'interactive-active' : 'interactive-normal'
								}
							/>
						) : (
							<TableRowAssetIcon name="MagnifyingGlassIcon" />
						)}
					</Pressable>
				)}
			</View>

			{isSearching && (
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 8,
						marginBottom: 8,
					}}
				>
					<View style={{ flex: 1 }}>
						<TextInput
							placeholder={
								searchPlaceholder ??
								(activeTabId === 'server'
									? 'Search server emojis...'
									: 'Search default emojis...')
							}
							value={searchQuery}
							onChange={handleSearchChange}
							isClearable
							onClear={() => handleSearchChange('')}
							size="sm"
						/>
					</View>

					{allowDiscordPicker && (
						<Pressable
							onPress={handleOpenNativePicker}
							style={({ pressed }) => ({
								paddingHorizontal: 10,
								paddingVertical: 6,
								borderRadius: 8,
								backgroundColor: pressed
									? 'rgba(255, 255, 255, 0.15)'
									: 'rgba(255, 255, 255, 0.08)',
							})}
						>
							<Text variant="text-xs/semibold" style={{ color: '#00A8FC' }}>
								Discord
							</Text>
						</Pressable>
					)}
				</View>
			)}

			<View
				style={[{ height: effectiveHeight, marginTop: 4 }, style]}
				onStartShouldSetResponder={() => true}
				onResponderTerminationRequest={() => false}
			>
				<ScrollComponent
					ref={scrollRef}
					style={{ flex: 1 }}
					nestedScrollEnabled={true}
					disallowInterruption={true}
					keyboardShouldPersistTaps="always"
					showsVerticalScrollIndicator={true}
					scrollEventThrottle={16}
					onScroll={handleScroll}
					contentContainerStyle={{ paddingBottom: 12 }}
				>
					{filteredItems.length === 0 ? (
						<View
							style={{
								width: '100%',
								height: Math.max(100, effectiveHeight - 20),
								justifyContent: 'center',
								alignItems: 'center',
								gap: 6,
							}}
						>
							<Text variant="text-sm/normal" color="text-muted">
								{searchQuery.trim()
									? `No emojis matching "${searchQuery.trim()}"`
									: activeTabId === 'server'
										? 'No custom server emojis found'
										: 'No emojis available'}
							</Text>
							{allowDiscordPicker && (
								<Pressable
									onPress={handleOpenNativePicker}
									style={({ pressed }) => ({
										paddingHorizontal: 12,
										paddingVertical: 6,
										borderRadius: 8,
										backgroundColor: pressed
											? 'rgba(255, 255, 255, 0.15)'
											: 'rgba(255, 255, 255, 0.08)',
										marginTop: 4,
									})}
								>
									<Text variant="text-xs/semibold" style={{ color: '#00A8FC' }}>
										Browse Discord Emoji Picker
									</Text>
								</Pressable>
							)}
						</View>
					) : (
						<>
							{topSpacerHeight > 0 ? (
								<View style={{ height: topSpacerHeight }} />
							) : null}

							{visibleRows.map((rowItems, rIdx) => {
								const rowIndex = startRowIndex + rIdx
								return (
									<View
										key={`row-${rowIndex}`}
										style={{
											height: ROW_HEIGHT,
											flexDirection: 'row',
											gap: ITEM_GAP,
											alignItems: 'center',
										}}
									>
										{rowItems.map(item => (
											<EmojiGridCell
												key={item.id ?? item.char ?? item.formatted}
												item={item}
												onPress={handleItemPress}
											/>
										))}
									</View>
								)
							})}

							{bottomSpacerHeight > 0 ? (
								<View style={{ height: bottomSpacerHeight }} />
							) : null}
						</>
					)}
				</ScrollComponent>
			</View>
		</View>
	)
}
