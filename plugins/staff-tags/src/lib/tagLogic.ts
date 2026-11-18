import type { Tag, TagCustomConfig } from '../types'

export const BRAND_COLOR = '#5865F2'
export const TEXT_LIGHT = '#FFFFFF'
export const TEXT_DARK = '#000000'

export const TAG_KEYS = [
	'OWNER',
	'ADMIN',
	'STAFF',
	'MOD',
	'VC Mod',
	'Chat Mod',
	'WEBHOOK',
] as const

export function extractBaseColor(color: string): string {
	if (!color.includes('gradient')) return color
	const match = color.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/)
	return match ? match[0] : BRAND_COLOR
}

export function getPerceivedLuminance(color: string): number {
	const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
	if (rgbMatch) {
		const r = Number.parseInt(rgbMatch[1], 10)
		const g = Number.parseInt(rgbMatch[2], 10)
		const b = Number.parseInt(rgbMatch[3], 10)
		return (0.299 * r + 0.587 * g + 0.114 * b) / 255
	}
	const hex = color.startsWith('#') ? color.slice(1) : color
	const clean = hex.replace(/[^0-9a-fA-F]/g, '')
	let r = 0
	let g = 0
	let b = 0

	if (clean.length === 3) {
		r = Number.parseInt(clean[0] + clean[0], 16)
		g = Number.parseInt(clean[1] + clean[1], 16)
		b = Number.parseInt(clean[2] + clean[2], 16)
	} else if (clean.length >= 6) {
		r = Number.parseInt(clean.slice(0, 2), 16)
		g = Number.parseInt(clean.slice(2, 4), 16)
		b = Number.parseInt(clean.slice(4, 6), 16)
	}

	return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export function resolveTagStyle(
	tag: Tag,
	roleColor: string | undefined,
	useRoleColor: boolean,
	customConfig: TagCustomConfig | undefined,
): { text: string; textColor: string; backgroundColor: string; icon?: string } {
	const customColor = customConfig?.color?.trim()
	const effectiveCustomColor =
		customColor && customColor.length > 0 ? customColor : undefined

	const backgroundColor =
		effectiveCustomColor ??
		(useRoleColor ? roleColor : undefined) ??
		tag.backgroundColor ??
		BRAND_COLOR

	const baseBgColor = extractBaseColor(backgroundColor)
	const hasCustomStyle = Boolean(
		effectiveCustomColor || (useRoleColor && roleColor),
	)
	const textColor =
		hasCustomStyle || !tag.textColor
			? getPerceivedLuminance(baseBgColor) > 0.6
				? TEXT_DARK
				: TEXT_LIGHT
			: tag.textColor

	const displayText =
		customConfig?.name && customConfig.name.trim().length > 0
			? customConfig.name.trim()
			: tag.text

	const icon =
		customConfig?.icon && customConfig.icon.trim().length > 0
			? customConfig.icon.trim()
			: undefined

	return {
		text: displayText,
		textColor,
		backgroundColor,
		icon,
	}
}

export function isDiscordIconName(icon: string): boolean {
	const trimmed = icon.trim()
	if (trimmed.length === 0) return false
	return trimmed.includes('Icon')
}

export function formatChatTagText(text: string, icon?: string): string {
	if (!icon?.trim()) return text
	const trimmed = icon.trim()
	if (isDiscordIconName(trimmed)) {
		return text
	}
	return `${trimmed} ${text}`
}
