import { Stores } from '@valenced/discord/flux'
import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { useEffect, useState } from 'react'

export type ThemeBase = 'dark' | 'light' | 'midnight' | 'darker'

export interface ThemeTokens {
	theme: ThemeBase
	isLight: boolean
	backgroundBaseLower: string
	backgroundBaseLowest: string
	backgroundPrimary: string
	backgroundSecondary: string
	backgroundSecondaryAlt: string
	backgroundTertiary: string
	backgroundFloating: string
	backgroundModifierAccent: string
	backgroundModifierSelected: string
	cardPrimaryBg: string
	borderSubtle: string
	borderStrong: string
	textDefault: string
	textStrong: string
	textNormal: string
	textMuted: string
	textBrand: string
	brand500: string
	statusPositive: string
	statusOnline: string
	statusDanger: string
	iconDefault: string
	iconMuted: string
	interactiveNormal: string
	interactiveActive: string
	pillBg: string
	guildBarIconBackgroundDefault: string
	guildBarIconDefault: string
	[customField: string]: string | boolean | undefined
}

interface TokensModuleInternal {
	resolveSemanticColor?: (
		theme: ThemeBase,
		color: object,
		context?: unknown,
	) => string
	getSemanticColorName?: (color: object) => string
}

interface TokensModule {
	RawColor?: Record<string, string>
	SemanticColor?: Record<string, Record<string, { raw?: string } | undefined>>
	default?: {
		colors?: Record<string, object>
		unsafe_rawColors?: Record<string, string>
		internal?: TokensModuleInternal
	}
}

interface ThemeStoreInterface {
	theme?: string
	getState?: () => { theme?: string }
	addChangeListener?: (listener: () => void) => void
	removeChangeListener?: (listener: () => void) => void
}

let cachedTokensModule: TokensModule | undefined
let cachedThemeStore: ThemeStoreInterface | undefined
let cachedAllTokens: string[] | undefined
let currentThemeOverrides: Record<string, string> | undefined
const themeListeners = new Set<() => void>()

export function setThemeOverrides(overrides?: Record<string, string>): void {
	currentThemeOverrides = overrides
	notifyThemeListeners()
}

export function getThemeOverrides(): Record<string, string> | undefined {
	return currentThemeOverrides
}

export function resetThemeOverrides(): void {
	currentThemeOverrides = undefined
	notifyThemeListeners()
}

function notifyThemeListeners(): void {
	for (const listener of themeListeners) {
		try {
			listener()
		} catch {}
	}
}

export function getTokensModule(): TokensModule | undefined {
	if (cachedTokensModule) {
		return cachedTokensModule
	}
	try {
		const globalObj = globalThis as unknown as {
			valenced?: {
				discord?: {
					tokens?: TokensModule
				}
			}
		}
		if (globalObj.valenced?.discord?.tokens) {
			cachedTokensModule = globalObj.valenced.discord.tokens
			return cachedTokensModule
		}
		const [mod] = lookupModule(
			withProps<TokensModule>('RawColor', 'SemanticColor'),
		)
		if (mod) {
			cachedTokensModule = mod
			return cachedTokensModule
		}
		const [modRaw] = lookupModule(withProps<TokensModule>('RawColor'))
		if (modRaw) {
			cachedTokensModule = modRaw
			return cachedTokensModule
		}
	} catch {}
	return undefined
}

export function resetTokensModuleCache(): void {
	cachedTokensModule = undefined
	cachedAllTokens = undefined
}

export function getThemeStore(): ThemeStoreInterface | undefined {
	if (cachedThemeStore) {
		return cachedThemeStore
	}
	try {
		const fluxStores = Stores as unknown as {
			ThemeStore?: ThemeStoreInterface
		}
		if (fluxStores.ThemeStore) {
			cachedThemeStore = fluxStores.ThemeStore
			return cachedThemeStore
		}
		const globalObj = globalThis as unknown as {
			valenced?: {
				discord?: {
					flux?: {
						stores?: {
							ThemeStore?: ThemeStoreInterface
						}
						Stores?: {
							ThemeStore?: ThemeStoreInterface
						}
					}
				}
			}
		}
		if (globalObj.valenced?.discord?.flux?.Stores?.ThemeStore) {
			cachedThemeStore = globalObj.valenced.discord.flux.Stores.ThemeStore
			return cachedThemeStore
		}
		if (globalObj.valenced?.discord?.flux?.stores?.ThemeStore) {
			cachedThemeStore = globalObj.valenced.discord.flux.stores.ThemeStore
			return cachedThemeStore
		}
	} catch {}
	return undefined
}

export function resetThemeStoreCache(): void {
	cachedThemeStore = undefined
}

export function getActiveTheme(): ThemeBase {
	const store = getThemeStore()
	const rawTheme = store?.theme ?? store?.getState?.()?.theme
	if (
		rawTheme === 'light' ||
		rawTheme === 'midnight' ||
		rawTheme === 'darker' ||
		rawTheme === 'dark'
	) {
		return rawTheme
	}
	return 'dark'
}

export function resolveThemeSemanticColor(
	tokenName: string,
	fallbackColor: string,
	theme: ThemeBase = getActiveTheme(),
): string {
	try {
		const tokensMod = getTokensModule()
		const internal = tokensMod?.default?.internal
		const defColorToken = tokensMod?.default?.colors?.[tokenName]
		if (internal?.resolveSemanticColor && defColorToken) {
			try {
				const resolved = internal.resolveSemanticColor(theme, defColorToken)
				if (typeof resolved === 'string' && resolved.length > 0) {
					return resolved
				}
			} catch {}
		}
		const semDef = tokensMod?.SemanticColor?.[tokenName] as
			| Record<string, { raw?: string }>
			| undefined
		if (semDef && typeof semDef === 'object') {
			const themeRaw = semDef[theme]?.raw ?? semDef.dark?.raw
			if (typeof themeRaw === 'string') {
				const resolvedRaw =
					tokensMod?.RawColor?.[themeRaw] ??
					tokensMod?.default?.unsafe_rawColors?.[themeRaw]
				if (typeof resolvedRaw === 'string' && resolvedRaw.length > 0) {
					return resolvedRaw
				}
			}
		}
		const rawColor =
			tokensMod?.RawColor?.[tokenName] ??
			tokensMod?.default?.unsafe_rawColors?.[tokenName]
		if (typeof rawColor === 'string' && rawColor.length > 0) {
			return rawColor
		}
	} catch {}
	return fallbackColor
}

export function resolveFirstSemanticColor(
	tokenNames: readonly string[],
	fallbackColor: string,
	theme: ThemeBase = getActiveTheme(),
): string {
	for (const name of tokenNames) {
		const resolved = resolveThemeSemanticColor(name, '', theme)
		if (resolved.length > 0) {
			return resolved
		}
	}
	return fallbackColor
}

export function resolveRawColor(
	rawName: string,
	fallbackColor: string,
): string {
	try {
		const tokensMod = getTokensModule()
		const rawColor =
			tokensMod?.RawColor?.[rawName] ??
			tokensMod?.default?.unsafe_rawColors?.[rawName]
		if (typeof rawColor === 'string' && rawColor.length > 0) {
			return rawColor
		}
	} catch {}
	return fallbackColor
}

export function resolveCustomTokenOrColor(
	value: string | undefined,
	defaultColor: string,
	theme: ThemeBase = getActiveTheme(),
): string {
	if (!value || typeof value !== 'string') {
		return defaultColor
	}
	const trimmed = value.trim()
	if (!trimmed) {
		return defaultColor
	}
	if (
		trimmed.startsWith('#') ||
		trimmed.startsWith('rgb(') ||
		trimmed.startsWith('rgba(') ||
		trimmed.startsWith('hsl(') ||
		trimmed.startsWith('hsla(')
	) {
		return trimmed
	}
	const resolvedSemantic = resolveThemeSemanticColor(trimmed, '', theme)
	if (resolvedSemantic.length > 0) {
		return resolvedSemantic
	}
	const resolvedRaw = resolveRawColor(trimmed, '')
	if (resolvedRaw.length > 0) {
		return resolvedRaw
	}
	return defaultColor
}

export function getAllDiscordTokenNames(): string[] {
	if (cachedAllTokens && cachedAllTokens.length > 0) {
		return cachedAllTokens
	}
	try {
		const tokensMod = getTokensModule()
		const semantic = Object.keys(
			tokensMod?.default?.colors ?? tokensMod?.SemanticColor ?? {},
		)
		const raw = Object.keys(
			tokensMod?.RawColor ?? tokensMod?.default?.unsafe_rawColors ?? {},
		)
		const set = new Set<string>([...semantic, ...raw])
		const sorted = Array.from(set).sort()
		if (sorted.length > 0) {
			cachedAllTokens = sorted
			return cachedAllTokens
		}
	} catch {}
	return []
}

export function filterDiscordTokens(
	query: string,
	maxResults = 12,
	theme: ThemeBase = getActiveTheme(),
): Array<{ name: string; hex: string }> {
	const all = getAllDiscordTokenNames()
	const q = query.trim().toUpperCase()
	let matchedNames: string[] = []
	if (!q) {
		matchedNames = [
			'STATUS_ONLINE',
			'ICON_STATUS_ONLINE',
			'TEXT_STATUS_ONLINE',
			'STATUS_POSITIVE',
			'STATUS_POSITIVE_TEXT',
			'STATUS_DANGER',
			'CARD_SECONDARY_BG',
			'BACKGROUND_PRIMARY',
			'BACKGROUND_SECONDARY',
			'TEXT_DEFAULT',
			'TEXT_STRONG',
			'BRAND_500',
			'GREEN_360',
			'GREEN_400',
		]
	} else {
		const prefixMatches: string[] = []
		const otherMatches: string[] = []
		for (const name of all) {
			if (name.startsWith(q)) {
				prefixMatches.push(name)
			} else if (name.includes(q)) {
				otherMatches.push(name)
			}
			if (prefixMatches.length + otherMatches.length >= maxResults * 2) {
				break
			}
		}
		matchedNames = [...prefixMatches, ...otherMatches].slice(0, maxResults)
	}

	return matchedNames.map(name => ({
		name,
		hex: resolveThemeSemanticColor(name, '', theme),
	}))
}

export function getThemeTokens(
	theme: ThemeBase = getActiveTheme(),
	overrides: Record<string, string> | undefined = currentThemeOverrides,
): ThemeTokens {
	const isLight = theme === 'light'
	const isMidnight = theme === 'midnight'

	const defaultBgBaseLower = isLight
		? '#f2f3f5'
		: isMidnight
			? '#000000'
			: '#313338'
	const defaultBgBaseLowest = isLight
		? '#ebedef'
		: isMidnight
			? '#000000'
			: '#1e1f22'
	const defaultBgPrimary = isLight
		? '#ffffff'
		: isMidnight
			? '#000000'
			: '#313338'
	const defaultBgSecondary = isLight
		? '#f2f3f5'
		: isMidnight
			? '#111214'
			: '#2b2d31'
	const defaultBgSecondaryAlt = isLight
		? '#ebedef'
		: isMidnight
			? '#18191c'
			: '#2b2d31'
	const defaultBgTertiary = isLight
		? '#e3e5e8'
		: isMidnight
			? '#080808'
			: '#1e1f22'
	const defaultBgFloating = isLight
		? '#ffffff'
		: isMidnight
			? '#111214'
			: '#2b2d31'
	const defaultModifierAccent = isLight
		? 'rgba(0, 0, 0, 0.05)'
		: 'rgba(255, 255, 255, 0.06)'
	const defaultModifierSelected = isLight
		? 'rgba(88, 101, 242, 0.15)'
		: 'rgba(88, 101, 242, 0.2)'
	const defaultCardPrimaryBg = isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.04)'
	const defaultBorderSubtle = isLight
		? 'rgba(0, 0, 0, 0.08)'
		: 'rgba(255, 255, 255, 0.08)'
	const defaultBorderStrong = isLight
		? 'rgba(0, 0, 0, 0.16)'
		: 'rgba(255, 255, 255, 0.16)'
	const defaultTextStrong = isLight ? '#060607' : '#ffffff'
	const defaultTextDefault = isLight ? '#2e3338' : '#f2f3f5'
	const defaultTextMuted = isLight ? '#747f8d' : '#80848e'
	const defaultIconDefault = isLight ? '#4f545c' : '#b5bac1'
	const defaultIconMuted = isLight ? '#747f8d' : '#80848e'
	const defaultInteractiveActive = isLight ? '#060607' : '#ffffff'
	const defaultPillBg = isLight ? '#060607' : '#ffffff'

	const textStrong = resolveFirstSemanticColor(
		[
			'TEXT_STRONG',
			'TEXT_DEFAULT',
			'MOBILE_TEXT_HEADING_PRIMARY',
			'HEADER_PRIMARY',
		],
		defaultTextStrong,
		theme,
	)
	const textDefault = resolveFirstSemanticColor(
		['TEXT_DEFAULT', 'TEXT_STRONG', 'TEXT_NORMAL'],
		defaultTextDefault,
		theme,
	)
	const textMuted = resolveFirstSemanticColor(
		['TEXT_MUTED', 'HEADER_SECONDARY'],
		defaultTextMuted,
		theme,
	)
	const iconDefault = resolveFirstSemanticColor(
		['ICON_DEFAULT', 'INTERACTIVE_NORMAL'],
		defaultIconDefault,
		theme,
	)
	const iconMuted = resolveFirstSemanticColor(
		['ICON_MUTED', 'TEXT_MUTED'],
		defaultIconMuted,
		theme,
	)

	const defaultStatusOnline = resolveFirstSemanticColor(
		['STATUS_ONLINE', 'ICON_STATUS_ONLINE', 'TEXT_STATUS_ONLINE'],
		isLight
			? resolveRawColor('GREEN_400', resolveRawColor('GREEN_360', ''))
			: resolveRawColor('GREEN_360', resolveRawColor('GREEN_400', '')),
		theme,
	)
	const defaultStatusPositive = resolveFirstSemanticColor(
		['STATUS_POSITIVE_TEXT', 'TEXT_FEEDBACK_POSITIVE', 'STATUS_POSITIVE'],
		resolveRawColor('GREEN_360', resolveRawColor('STATUS_POSITIVE', '')),
		theme,
	)
	const defaultStatusDanger = resolveFirstSemanticColor(
		['STATUS_DANGER', 'TEXT_FEEDBACK_CRITICAL'],
		resolveRawColor('RED_400', resolveRawColor('STATUS_DANGER', '#f23f43')),
		theme,
	)
	const defaultBrand500 = resolveRawColor('BRAND_500', '#5865F2')

	const result: ThemeTokens = {
		theme,
		isLight,
		backgroundBaseLower: resolveCustomTokenOrColor(
			overrides?.backgroundBaseLower,
			resolveFirstSemanticColor(
				['BACKGROUND_BASE_LOWER', 'BACKGROUND_BASE_LOW'],
				defaultBgBaseLower,
				theme,
			),
			theme,
		),
		backgroundBaseLowest: resolveCustomTokenOrColor(
			overrides?.backgroundBaseLowest,
			resolveFirstSemanticColor(
				['BACKGROUND_BASE_LOWEST'],
				defaultBgBaseLowest,
				theme,
			),
			theme,
		),
		backgroundPrimary: resolveCustomTokenOrColor(
			overrides?.backgroundPrimary,
			resolveFirstSemanticColor(
				['BACKGROUND_PRIMARY', 'BACKGROUND_BASE_LOWER'],
				defaultBgPrimary,
				theme,
			),
			theme,
		),
		backgroundSecondary: resolveCustomTokenOrColor(
			overrides?.backgroundSecondary,
			resolveFirstSemanticColor(
				[
					'CARD_SECONDARY_BG',
					'BACKGROUND_SECONDARY_ALT',
					'BACKGROUND_SURFACE_HIGH',
					'BACKGROUND_SECONDARY',
				],
				defaultBgSecondary,
				theme,
			),
			theme,
		),
		backgroundSecondaryAlt: resolveCustomTokenOrColor(
			overrides?.backgroundSecondaryAlt,
			resolveFirstSemanticColor(
				[
					'BACKGROUND_SECONDARY_ALT',
					'CARD_SECONDARY_BG',
					'BACKGROUND_SURFACE_HIGH',
				],
				defaultBgSecondaryAlt,
				theme,
			),
			theme,
		),
		backgroundTertiary: resolveCustomTokenOrColor(
			overrides?.backgroundTertiary,
			resolveFirstSemanticColor(
				[
					'BACKGROUND_BASE_LOWEST',
					'BACKGROUND_SURFACE_HIGHEST',
					'BACKGROUND_TERTIARY',
				],
				defaultBgTertiary,
				theme,
			),
			theme,
		),
		backgroundFloating: resolveCustomTokenOrColor(
			overrides?.backgroundFloating,
			resolveFirstSemanticColor(
				[
					'BACKGROUND_SURFACE_HIGH',
					'BACKGROUND_SECONDARY_ALT',
					'BACKGROUND_FLOATING',
				],
				defaultBgFloating,
				theme,
			),
			theme,
		),
		backgroundModifierAccent: resolveCustomTokenOrColor(
			overrides?.backgroundModifierAccent,
			resolveFirstSemanticColor(
				[
					'BACKGROUND_MOD_SUBTLE',
					'BACKGROUND_MOD_NORMAL',
					'BACKGROUND_MOD_MUTED',
					'BACKGROUND_MODIFIER_ACCENT',
				],
				defaultModifierAccent,
				theme,
			),
			theme,
		),
		backgroundModifierSelected: resolveCustomTokenOrColor(
			overrides?.backgroundModifierSelected,
			resolveFirstSemanticColor(
				[
					'INTERACTIVE_BACKGROUND_SELECTED',
					'INTERACTIVE_ACCENT_BACKGROUND_SELECTED',
					'BACKGROUND_MODIFIER_SELECTED',
				],
				defaultModifierSelected,
				theme,
			),
			theme,
		),
		cardPrimaryBg: resolveCustomTokenOrColor(
			overrides?.cardPrimaryBg,
			resolveFirstSemanticColor(
				[
					'CARD_SECONDARY_BG',
					'CARD_BACKGROUND_DEFAULT',
					'CARD_MUTED_BG',
					'CARD_PRIMARY_BG',
					'BACKGROUND_SECONDARY_ALT',
				],
				defaultCardPrimaryBg,
				theme,
			),
			theme,
		),
		borderSubtle: resolveCustomTokenOrColor(
			overrides?.borderSubtle,
			resolveFirstSemanticColor(['BORDER_SUBTLE'], defaultBorderSubtle, theme),
			theme,
		),
		borderStrong: resolveCustomTokenOrColor(
			overrides?.borderStrong,
			resolveFirstSemanticColor(['BORDER_STRONG'], defaultBorderStrong, theme),
			theme,
		),
		textDefault: resolveCustomTokenOrColor(
			overrides?.textDefault,
			textDefault,
			theme,
		),
		textStrong: resolveCustomTokenOrColor(
			overrides?.textStrong,
			textStrong,
			theme,
		),
		textNormal: resolveCustomTokenOrColor(
			overrides?.textNormal,
			textDefault,
			theme,
		),
		textMuted: resolveCustomTokenOrColor(
			overrides?.textMuted,
			textMuted,
			theme,
		),
		textBrand: resolveCustomTokenOrColor(
			overrides?.textBrand,
			resolveFirstSemanticColor(
				['TEXT_BRAND', 'BRAND_500'],
				defaultBrand500,
				theme,
			),
			theme,
		),
		brand500: resolveCustomTokenOrColor(
			overrides?.brand500,
			defaultBrand500,
			theme,
		),
		statusPositive: resolveCustomTokenOrColor(
			overrides?.statusPositive,
			defaultStatusPositive,
			theme,
		),
		statusOnline: resolveCustomTokenOrColor(
			overrides?.statusOnline,
			defaultStatusOnline,
			theme,
		),
		statusDanger: resolveCustomTokenOrColor(
			overrides?.statusDanger,
			defaultStatusDanger,
			theme,
		),
		iconDefault: resolveCustomTokenOrColor(
			overrides?.iconDefault,
			iconDefault,
			theme,
		),
		iconMuted: resolveCustomTokenOrColor(
			overrides?.iconMuted,
			iconMuted,
			theme,
		),
		interactiveNormal: resolveCustomTokenOrColor(
			overrides?.interactiveNormal,
			iconDefault,
			theme,
		),
		interactiveActive: resolveCustomTokenOrColor(
			overrides?.interactiveActive,
			resolveFirstSemanticColor(
				['INTERACTIVE_ACTIVE', 'TEXT_STRONG'],
				defaultInteractiveActive,
				theme,
			),
			theme,
		),
		pillBg: resolveCustomTokenOrColor(
			overrides?.pillBg,
			resolveFirstSemanticColor(
				['TEXT_STRONG', 'TEXT_DEFAULT', 'HEADER_PRIMARY'],
				defaultPillBg,
				theme,
			),
			theme,
		),
		guildBarIconBackgroundDefault: resolveCustomTokenOrColor(
			overrides?.guildBarIconBackgroundDefault,
			resolveThemeSemanticColor(
				'MOBILE_GUILDBAR_ICON_BACKGROUND_DEFAULT',
				'#97979f1f',
				theme,
			),
			theme,
		),
		guildBarIconDefault: resolveCustomTokenOrColor(
			overrides?.guildBarIconDefault,
			resolveThemeSemanticColor(
				'MOBILE_GUILDBAR_ICON_DEFAULT',
				'#c5c6ca',
				theme,
			),
			theme,
		),
	}

	if (overrides) {
		for (const [key, val] of Object.entries(overrides)) {
			if (!(key in result) && typeof val === 'string') {
				result[key] = resolveCustomTokenOrColor(val, '', theme)
			}
		}
	}

	return result
}

export function subscribeThemeChange(listener: () => void): () => void {
	themeListeners.add(listener)
	const store = getThemeStore()
	const onStoreChange = () => {
		listener()
	}
	if (store?.addChangeListener) {
		store.addChangeListener(onStoreChange)
		return () => {
			themeListeners.delete(listener)
			store.removeChangeListener?.(onStoreChange)
		}
	}
	return () => {
		themeListeners.delete(listener)
	}
}

export function useThemeTokens(): ThemeTokens {
	const [tick, setTick] = useState(0)
	useEffect(() => {
		const handler = () => {
			setTick(prev => prev + 1)
		}
		return subscribeThemeChange(handler)
	}, [])
	void tick
	const theme = getActiveTheme()
	return getThemeTokens(theme)
}

interface WrapperStylesModule {
	useGuildsBarAnimatedWrapperStyles?: () => {
		pressableWrapper?: Record<string, unknown>
		itemShape?: Record<string, unknown>
	}
}

let cachedWrapperStylesMod: WrapperStylesModule | undefined

export function useStockTileStyles(): {
	pressableWrapper?: Record<string, unknown>
	itemShape?: Record<string, unknown>
} {
	if (!cachedWrapperStylesMod) {
		try {
			const [mod] = lookupModule(
				withProps<WrapperStylesModule>('useGuildsBarAnimatedWrapperStyles'),
			)
			if (mod) cachedWrapperStylesMod = mod
		} catch {}
	}
	if (
		typeof cachedWrapperStylesMod?.useGuildsBarAnimatedWrapperStyles ===
		'function'
	) {
		try {
			return cachedWrapperStylesMod.useGuildsBarAnimatedWrapperStyles()
		} catch {}
	}
	return {
		itemShape: {
			borderRadius: 16,
		},
		pressableWrapper: {
			position: 'relative',
			paddingTop: 6,
			paddingBottom: 6,
			paddingLeft: 12,
			height: 60,
			width: 72,
			alignItems: 'flex-start',
			justifyContent: 'center',
		},
	}
}
