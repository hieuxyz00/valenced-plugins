import { ColorPickerModal } from './components/ColorPickerModal'
import {
	cleanupEmojiPickerPatch,
	DiscordEmojiPicker,
	EmojiIntention,
	extractEmoji,
	formatEmoji,
	getBottomSheetScrollView,
	getDefaultUnicodeEmojis,
	getGuildEmojis,
	getUnicodeEmojisByCategory,
	isGuildOrUnicodeEmoji,
	openDiscordEmojiPicker,
	UNICODE_CATEGORY_LABELS,
} from './components/DiscordEmojiPicker'
import {
	DEFAULT_DISCORD_ICONS,
	EMOJI_CATEGORIES,
	EmojiPicker,
} from './components/EmojiPicker'
import { ColorPicker, HtmlColorPicker } from './components/HtmlColorPicker'
import { LanguagePickerModal } from './components/LanguagePickerModal'
import { PipModal } from './components/PipModal'
import {
	getContrastColor,
	getLuminance,
	hexToRgb,
	hsvToRgb,
	rgbToHex,
	rgbToHsl,
	rgbToHsv,
} from './math/color'
import * as saf from './saf'

export {
	ColorPicker,
	ColorPickerModal,
	cleanupEmojiPickerPatch,
	DEFAULT_DISCORD_ICONS,
	DiscordEmojiPicker,
	EMOJI_CATEGORIES,
	EmojiIntention,
	EmojiPicker,
	extractEmoji,
	formatEmoji,
	getBottomSheetScrollView,
	getContrastColor,
	getDefaultUnicodeEmojis,
	getGuildEmojis,
	getLuminance,
	getUnicodeEmojisByCategory,
	HtmlColorPicker,
	hexToRgb,
	hsvToRgb,
	isGuildOrUnicodeEmoji,
	LanguagePickerModal,
	openDiscordEmojiPicker,
	PipModal,
	rgbToHex,
	rgbToHsl,
	rgbToHsv,
	saf,
	UNICODE_CATEGORY_LABELS,
}

export const hieuxyzApi = {
	PipModal,
	ColorPickerModal,
	ColorPicker,
	HtmlColorPicker,
	EmojiPicker,
	DiscordEmojiPicker,
	cleanupEmojiPickerPatch,
	openDiscordEmojiPicker,
	formatEmoji,
	extractEmoji,
	isGuildOrUnicodeEmoji,
	getDefaultUnicodeEmojis,
	getGuildEmojis,
	getUnicodeEmojisByCategory,
	UNICODE_CATEGORY_LABELS,
	getBottomSheetScrollView,
	EmojiIntention,
	LanguagePickerModal,
	DEFAULT_DISCORD_ICONS,
	saf,
	color: {
		hsvToRgb,
		rgbToHsv,
		rgbToHex,
		hexToRgb,
		rgbToHsl,
		getLuminance,
		getContrastColor,
	},
}

export type HieuxyzApi = typeof hieuxyzApi

export default plugin({
	start({ decorate, unscoped }) {
		unscoped.hieuxyz = hieuxyzApi
		try {
			const g = globalThis as unknown as {
				valenced?: { hieuxyz?: HieuxyzApi }
			}
			if (g.valenced) {
				g.valenced.hieuxyz = hieuxyzApi
			}
		} catch {}
		decorate(target => {
			target.api.hieuxyz = hieuxyzApi
			return () => {
				target.api.hieuxyz = undefined
			}
		})
	},
	stop({ unscoped }) {
		unscoped.hieuxyz = undefined
		try {
			const g = globalThis as unknown as {
				valenced?: { hieuxyz?: HieuxyzApi }
			}
			if (g.valenced && g.valenced.hieuxyz === hieuxyzApi) {
				g.valenced.hieuxyz = undefined
			}
		} catch {}
	},
})

declare module '@valenced/plugins/types' {
	interface PluginApi {
		hieuxyz?: HieuxyzApi
	}
	interface UnscopedPluginApi {
		hieuxyz?: HieuxyzApi
	}
}
