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
	statusDanger: string
	iconDefault: string
	iconMuted: string
	interactiveNormal: string
	interactiveActive: string
	pillBg: string
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
	SemanticColor?: Record<string, object>
	default?: {
		colors?: Record<string, object>
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
		if (internal?.resolveSemanticColor) {
			const colorToken =
				tokensMod?.default?.colors?.[tokenName] ??
				tokensMod?.SemanticColor?.[tokenName]
			if (colorToken) {
				const resolved = internal.resolveSemanticColor(theme, colorToken)
				if (typeof resolved === 'string' && resolved.length > 0) {
					return resolved
				}
			}
		}
		const rawColor = tokensMod?.RawColor?.[tokenName]
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
		const rawColor = tokensMod?.RawColor?.[rawName]
		if (typeof rawColor === 'string' && rawColor.length > 0) {
			return rawColor
		}
	} catch {}
	return fallbackColor
}

export function getThemeTokens(
	theme: ThemeBase = getActiveTheme(),
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

	return {
		theme,
		isLight,
		backgroundBaseLower: resolveFirstSemanticColor(
			['BACKGROUND_BASE_LOWER', 'BACKGROUND_BASE_LOW'],
			defaultBgBaseLower,
			theme,
		),
		backgroundBaseLowest: resolveFirstSemanticColor(
			['BACKGROUND_BASE_LOWEST'],
			defaultBgBaseLowest,
			theme,
		),
		backgroundPrimary: resolveFirstSemanticColor(
			['BACKGROUND_PRIMARY', 'BACKGROUND_BASE_LOWER'],
			defaultBgPrimary,
			theme,
		),
		backgroundSecondary: resolveFirstSemanticColor(
			[
				'CARD_SECONDARY_BG',
				'BACKGROUND_SECONDARY_ALT',
				'BACKGROUND_SURFACE_HIGH',
				'BACKGROUND_SECONDARY',
			],
			defaultBgSecondary,
			theme,
		),
		backgroundSecondaryAlt: resolveFirstSemanticColor(
			[
				'BACKGROUND_SECONDARY_ALT',
				'CARD_SECONDARY_BG',
				'BACKGROUND_SURFACE_HIGH',
			],
			defaultBgSecondaryAlt,
			theme,
		),
		backgroundTertiary: resolveFirstSemanticColor(
			[
				'BACKGROUND_BASE_LOWEST',
				'BACKGROUND_SURFACE_HIGHEST',
				'BACKGROUND_TERTIARY',
			],
			defaultBgTertiary,
			theme,
		),
		backgroundFloating: resolveFirstSemanticColor(
			[
				'BACKGROUND_SURFACE_HIGH',
				'BACKGROUND_SECONDARY_ALT',
				'BACKGROUND_FLOATING',
			],
			defaultBgFloating,
			theme,
		),
		backgroundModifierAccent: resolveFirstSemanticColor(
			[
				'BACKGROUND_MOD_SUBTLE',
				'BACKGROUND_MOD_NORMAL',
				'BACKGROUND_MOD_MUTED',
				'BACKGROUND_MODIFIER_ACCENT',
			],
			defaultModifierAccent,
			theme,
		),
		backgroundModifierSelected: resolveFirstSemanticColor(
			[
				'INTERACTIVE_BACKGROUND_SELECTED',
				'INTERACTIVE_ACCENT_BACKGROUND_SELECTED',
				'BACKGROUND_MODIFIER_SELECTED',
			],
			defaultModifierSelected,
			theme,
		),
		cardPrimaryBg: resolveFirstSemanticColor(
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
		borderSubtle: resolveFirstSemanticColor(
			['BORDER_SUBTLE'],
			defaultBorderSubtle,
			theme,
		),
		borderStrong: resolveFirstSemanticColor(
			['BORDER_STRONG'],
			defaultBorderStrong,
			theme,
		),
		textDefault,
		textStrong,
		textNormal: textDefault,
		textMuted,
		textBrand: resolveFirstSemanticColor(
			['TEXT_BRAND', 'BRAND_500'],
			resolveRawColor('BRAND_500', '#5865F2'),
			theme,
		),
		brand500: resolveRawColor('BRAND_500', '#5865F2'),
		statusPositive: resolveFirstSemanticColor(
			['STATUS_POSITIVE_TEXT', 'TEXT_FEEDBACK_POSITIVE', 'STATUS_POSITIVE'],
			'#23a55a',
			theme,
		),
		statusDanger: resolveFirstSemanticColor(
			['STATUS_DANGER', 'TEXT_FEEDBACK_CRITICAL'],
			'#f23f43',
			theme,
		),
		iconDefault,
		iconMuted,
		interactiveNormal: iconDefault,
		interactiveActive: resolveFirstSemanticColor(
			['INTERACTIVE_ACTIVE', 'TEXT_STRONG'],
			defaultInteractiveActive,
			theme,
		),
		pillBg: resolveFirstSemanticColor(
			['TEXT_STRONG', 'TEXT_DEFAULT', 'HEADER_PRIMARY'],
			defaultPillBg,
			theme,
		),
	}
}

export function subscribeThemeChange(listener: () => void): () => void {
	const store = getThemeStore()
	if (store?.addChangeListener) {
		store.addChangeListener(listener)
		return () => {
			store.removeChangeListener?.(listener)
		}
	}
	return () => {}
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
