import { Tokens } from '@valenced/discord/common/tokens'
import { Stores } from '@valenced/discord/flux'
import { useEffect, useState } from 'react'

interface ThemeStoreLike {
	theme?: string
	getState?: () => { theme?: string }
	addChangeListener?: (fn: () => void) => void
	removeChangeListener?: (fn: () => void) => void
}

export function getActiveTheme(): string {
	try {
		const store = Stores.ThemeStore as ThemeStoreLike | undefined
		const stateTheme = store?.getState?.()?.theme
		if (typeof stateTheme === 'string' && stateTheme) return stateTheme
		const directTheme = store?.theme
		if (typeof directTheme === 'string' && directTheme) return directTheme
		return 'dark'
	} catch {
		return 'dark'
	}
}

export function isDarkTheme(): boolean {
	const theme = getActiveTheme().toLowerCase()
	return theme !== 'light'
}

export function resolveSemanticColor(
	tokenOrColor: unknown,
	fallback = '#5865F2',
): string {
	if (typeof tokenOrColor !== 'string' || !tokenOrColor.trim()) {
		return fallback
	}
	const val = tokenOrColor.trim()
	if (
		val.startsWith('#') ||
		val.startsWith('rgb(') ||
		val.startsWith('rgba(')
	) {
		return val
	}

	const theme = getActiveTheme()
	const tokens = Tokens.default
	const colors = tokens.colors as Record<string, unknown>

	if (colors[val]) {
		try {
			const resolved = tokens.internal.resolveSemanticColor(theme, colors[val])
			if (typeof resolved === 'string' && resolved) return resolved
		} catch {}
	}

	const rawColors = (tokens as unknown as { rawColors?: Record<string, string> })
		.rawColors
	if (rawColors?.[val]) {
		return rawColors[val]
	}

	return fallback
}

export interface SharedThemeTokens {
	theme: string
	isDark: boolean
	textNormal: string
	textMuted: string
	textHeader: string
	textBrand: string
	textDanger: string
	textPositive: string
	bgPrimary: string
	bgSecondary: string
	bgTertiary: string
	bgFloating: string
	bgModifierAccent: string
	bgModifierSelected: string
	bgModifierHover: string
	cardPrimaryBg: string
	cardBorder: string
	interactiveNormal: string
	interactiveActive: string
	interactiveHover: string
	brand: string
}

export function getSharedThemeTokens(): SharedThemeTokens {
	const theme = getActiveTheme()
	const isDark = isDarkTheme()
	const tokens = Tokens.default
	const colors = tokens.colors as Record<string, unknown>

	const resolve = (keys: string | string[], fallback: string) => {
		const keyList = Array.isArray(keys) ? keys : [keys]
		for (const key of keyList) {
			if (colors[key]) {
				try {
					const res = tokens.internal.resolveSemanticColor(theme, colors[key])
					if (typeof res === 'string' && res) return res
				} catch {}
			}
		}
		return fallback
	}

	return {
		theme,
		isDark,
		textNormal: resolve(
			['TEXT_DEFAULT', 'TEXT_NORMAL', 'INTERACTIVE_TEXT_DEFAULT', 'TEXT_PRIMARY'],
			isDark ? '#f2f3f5' : '#313338',
		),
		textMuted: resolve(
			['TEXT_MUTED', 'TEXT_SUBTLE', 'HEADER_SECONDARY', 'TEXT_SECONDARY'],
			isDark ? '#949ba4' : '#5c5f66',
		),
		textHeader: resolve(
			['TEXT_STRONG', 'MOBILE_TEXT_HEADING_PRIMARY', 'HEADER_PRIMARY', 'TEXT_DEFAULT'],
			isDark ? '#ffffff' : '#060607',
		),
		textBrand: resolve(['TEXT_BRAND', 'BRAND_500'], '#5865f2'),
		textDanger: resolve(['TEXT_FEEDBACK_CRITICAL', 'TEXT_DANGER'], '#f23f43'),
		textPositive: resolve(
			['TEXT_FEEDBACK_POSITIVE', 'STATUS_POSITIVE_TEXT', 'TEXT_POSITIVE'],
			'#23a55a',
		),
		bgPrimary: resolve(
			['CHANNEL_BACKGROUND_DEFAULT', 'BACKGROUND_BASE_LOW', 'BACKGROUND_PRIMARY', 'BG_BASE_PRIMARY', 'BACKGROUND_MOBILE_PRIMARY'],
			isDark ? '#313338' : '#ffffff',
		),
		bgSecondary: resolve(
			['BG_SURFACE_RAISED', 'BACKGROUND_SURFACE_HIGH', 'BACKGROUND_BASE_LOW', 'BACKGROUND_SECONDARY', 'BG_BASE_SECONDARY', 'BACKGROUND_MOBILE_SECONDARY'],
			isDark ? '#2b2d31' : '#f2f3f5',
		),
		bgTertiary: resolve(
			['BACKGROUND_BASE_LOWEST', 'USER_PROFILE_GRADIENT_BACKGROUND', 'BACKGROUND_BASE_LOWER', 'BACKGROUND_TERTIARY', 'BG_BASE_TERTIARY'],
			isDark ? '#1e1f22' : '#ebedef',
		),
		bgFloating: resolve(
			[
				'BACKGROUND_SURFACE_HIGH',
				'MOBILE_ACTIONSHEET_BACKGROUND',
				'MODAL_BACKGROUND',
				'BACKGROUND_BASE_LOWEST',
				'BACKGROUND_SURFACE_HIGHEST',
				'BACKGROUND_FLOATING',
				'BG_SURFACE_OVERLAY',
				'CARD_BACKGROUND_DEFAULT',
			],
			isDark ? '#18191c' : '#ffffff',
		),
		bgModifierAccent: resolve(
			['BACKGROUND_MOD_SUBTLE', 'BACKGROUND_MODIFIER_ACCENT', 'BORDER_SUBTLE'],
			isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
		),
		bgModifierSelected: resolve(
			[
				'INTERACTIVE_BACKGROUND_SELECTED',
				'BACKGROUND_MOD_STRONG',
				'BACKGROUND_MODIFIER_SELECTED',
			],
			isDark ? 'rgba(88, 101, 242, 0.2)' : 'rgba(88, 101, 242, 0.15)',
		),
		bgModifierHover: resolve(
			[
				'INTERACTIVE_BACKGROUND_HOVER',
				'BACKGROUND_MOD_NORMAL',
				'BACKGROUND_MODIFIER_HOVER',
			],
			isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
		),
		cardPrimaryBg: resolve(
			[
				'CARD_BACKGROUND_DEFAULT',
				'BG_SURFACE_RAISED',
				'BACKGROUND_SURFACE_HIGH',
				'CARD_PRIMARY_BG',
				'BACKGROUND_SECONDARY',
			],
			isDark ? '#2b2d31' : '#ffffff',
		),
		cardBorder: resolve(
			['BORDER_SUBTLE', 'BORDER_MUTED', 'BORDER_NORMAL', 'BACKGROUND_MODIFIER_ACCENT'],
			isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
		),
		interactiveNormal: resolve(
			[
				'INTERACTIVE_ICON_DEFAULT',
				'INTERACTIVE_TEXT_DEFAULT',
				'INTERACTIVE_NORMAL',
				'TAB_LABEL_TEXT_DEFAULT',
			],
			isDark ? '#b5bac1' : '#4e5058',
		),
		interactiveActive: resolve(
			[
				'INTERACTIVE_ICON_ACTIVE',
				'INTERACTIVE_TEXT_ACTIVE',
				'INTERACTIVE_ACTIVE',
				'TAB_LABEL_TEXT_FOCUSED',
			],
			isDark ? '#ffffff' : '#060607',
		),
		interactiveHover: resolve(
			[
				'INTERACTIVE_ICON_HOVER',
				'INTERACTIVE_TEXT_HOVER',
				'INTERACTIVE_HOVER',
			],
			isDark ? '#dbdee1' : '#2e3035',
		),
		brand: resolve(['BACKGROUND_BRAND', 'BRAND_500', 'CONTROL_PRIMARY_BACKGROUND_DEFAULT'], '#5865f2'),
	}
}

export function useSharedThemeTokens(): SharedThemeTokens {
	const [tokens, setTokens] = useState<SharedThemeTokens>(getSharedThemeTokens)

	useEffect(() => {
		const store = Stores.ThemeStore as ThemeStoreLike | undefined
		if (!store?.addChangeListener) return

		const listener = () => {
			setTokens(getSharedThemeTokens())
		}
		store.addChangeListener(listener)
		return () => {
			store.removeChangeListener?.(listener)
		}
	}, [])

	return tokens
}
