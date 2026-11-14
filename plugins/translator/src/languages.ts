import type { TranslationProvider, TranslationResult } from './types'

export const LANGUAGES: Readonly<Record<string, string>> = {
	af: 'Afrikaans',
	sq: 'Albanian',
	am: 'Amharic',
	ar: 'Arabic',
	hy: 'Armenian',
	az: 'Azerbaijani',
	eu: 'Basque',
	be: 'Belarusian',
	bn: 'Bengali',
	bs: 'Bosnian',
	bg: 'Bulgarian',
	ca: 'Catalan',
	ceb: 'Cebuano',
	ny: 'Chichewa',
	'zh-CN': 'Chinese (Simplified)',
	'zh-TW': 'Chinese (Traditional)',
	co: 'Corsican',
	hr: 'Croatian',
	cs: 'Czech',
	da: 'Danish',
	nl: 'Dutch',
	en: 'English',
	eo: 'Esperanto',
	et: 'Estonian',
	tl: 'Filipino',
	fi: 'Finnish',
	fr: 'French',
	fy: 'Frisian',
	gl: 'Galician',
	ka: 'Georgian',
	de: 'German',
	el: 'Greek',
	gu: 'Gujarati',
	ht: 'Haitian Creole',
	ha: 'Hausa',
	haw: 'Hawaiian',
	iw: 'Hebrew',
	hi: 'Hindi',
	hmn: 'Hmong',
	hu: 'Hungarian',
	is: 'Icelandic',
	ig: 'Igbo',
	id: 'Indonesian',
	ga: 'Irish',
	it: 'Italian',
	ja: 'Japanese',
	jw: 'Javanese',
	kn: 'Kannada',
	kk: 'Kazakh',
	km: 'Khmer',
	rw: 'Kinyarwanda',
	ko: 'Korean',
	ku: 'Kurdish (Kurmanji)',
	ky: 'Kyrgyz',
	lo: 'Lao',
	la: 'Latin',
	lv: 'Latvian',
	lt: 'Lithuanian',
	lb: 'Luxembourgish',
	mk: 'Macedonian',
	mg: 'Malagasy',
	ms: 'Malay',
	ml: 'Malayalam',
	mt: 'Maltese',
	mi: 'Maori',
	mr: 'Marathi',
	mn: 'Mongolian',
	my: 'Myanmar (Burmese)',
	ne: 'Nepali',
	no: 'Norwegian',
	or: 'Odia',
	ps: 'Pashto',
	fa: 'Persian',
	pl: 'Polish',
	pt: 'Portuguese',
	pa: 'Punjabi',
	ro: 'Romanian',
	ru: 'Russian',
	sm: 'Samoan',
	gd: 'Scots Gaelic',
	sr: 'Serbian',
	st: 'Sesotho',
	sn: 'Shona',
	sd: 'Sindhi',
	si: 'Sinhala',
	sk: 'Slovak',
	sl: 'Slovenian',
	so: 'Somali',
	es: 'Spanish',
	su: 'Sundanese',
	sw: 'Swahili',
	sv: 'Swedish',
	tg: 'Tajik',
	ta: 'Tamil',
	tt: 'Tatar',
	te: 'Telugu',
	th: 'Thai',
	tr: 'Turkish',
	tk: 'Turkmen',
	uk: 'Ukrainian',
	ur: 'Urdu',
	ug: 'Uyghur',
	uz: 'Uzbek',
	vi: 'Vietnamese',
	cy: 'Welsh',
	xh: 'Xhosa',
	yi: 'Yiddish',
	yo: 'Yoruba',
	zu: 'Zulu',
}

export const PROVIDERS: Readonly<Record<TranslationProvider, string>> = {
	google: 'Google Translate',
	microsoft: 'Microsoft Translate',
	mymemory: 'MyMemory Translate',
	lingva: 'Lingva Translate',
	brave: 'Brave Translate',
}

/** Get the human-readable language name for a given code. */
export function getLanguageName(code: string): string {
	if (code === 'auto') return 'Auto-detect'
	return LANGUAGES[code] ?? code
}

/** Get the human-readable provider name for a given provider id. */
export function getProviderName(provider: string): string {
	if (
		provider === 'google' ||
		provider === 'microsoft' ||
		provider === 'mymemory' ||
		provider === 'lingva' ||
		provider === 'brave'
	) {
		return PROVIDERS[provider]
	}
	return PROVIDERS.google
}

/** Format translation result into a Discord message markdown string. */
export function formatTranslationResult(
	result: TranslationResult,
	provider: TranslationProvider,
	source: string,
	target: string,
): string {
	const from =
		source === 'auto'
			? result.detected
				? `${getLanguageName(result.detected)} (auto)`
				: 'Auto-detect'
			: getLanguageName(source)

	return `🌐 **Translator** (${getProviderName(provider)})\n${from} ➜ ${getLanguageName(target)}\n${result.text}`
}
