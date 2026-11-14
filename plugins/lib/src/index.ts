import { ColorPickerModal } from './components/ColorPickerModal'
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

export {
	ColorPicker,
	ColorPickerModal,
	DEFAULT_DISCORD_ICONS,
	EMOJI_CATEGORIES,
	EmojiPicker,
	getContrastColor,
	getLuminance,
	HtmlColorPicker,
	hexToRgb,
	hsvToRgb,
	LanguagePickerModal,
	PipModal,
	rgbToHex,
	rgbToHsl,
	rgbToHsv,
}

export const hieuxyzApi = {
	PipModal,
	ColorPickerModal,
	ColorPicker,
	HtmlColorPicker,
	EmojiPicker,
	LanguagePickerModal,
	DEFAULT_DISCORD_ICONS,
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
		decorate(target => {
			target.api.hieuxyz = hieuxyzApi
			return () => {
				target.api.hieuxyz = undefined
			}
		})
	},
	stop({ unscoped }) {
		unscoped.hieuxyz = undefined
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
