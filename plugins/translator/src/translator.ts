import type { TranslationProvider, TranslationResult } from './types'

const MS_CODES: Readonly<Record<string, string>> = {
	'zh-CN': 'zh-Hans',
	'zh-TW': 'zh-Hant',
	iw: 'he',
	jw: 'jv',
	tl: 'fil',
	no: 'nb',
}

function msCode(code: string): string {
	return MS_CODES[code] ?? code
}

interface MicrosoftTokenCache {
	value: string
	at: number
}

let cachedMsToken: MicrosoftTokenCache | null = null

/** Clear in-memory Microsoft auth token cache (for test isolation). */
export function resetMicrosoftTokenCache(): void {
	cachedMsToken = null
}

function getTimeoutSignal(timeoutMs = 12000): AbortSignal | undefined {
	if (
		typeof AbortSignal !== 'undefined' &&
		typeof AbortSignal.timeout === 'function'
	) {
		return AbortSignal.timeout(timeoutMs)
	}
	return undefined
}

/** Translate text using Google Translate free endpoint (client=dict-chrome-ex with gtx fallback). */
export async function googleTranslate(
	text: string,
	source: string,
	target: string,
): Promise<TranslationResult> {
	const trimmed = text.trim()
	if (!trimmed) {
		throw new Error('No text to translate')
	}

	const enc = encodeURIComponent
	const clients = ['dict-chrome-ex', 'gtx']
	let lastError: Error | null = null

	for (const client of clients) {
		const url = `https://translate.googleapis.com/translate_a/single?client=${client}&sl=${enc(source)}&tl=${enc(target)}&dt=t&q=${enc(trimmed)}`

		let res: Response
		try {
			res = await fetch(url, { signal: getTimeoutSignal() })
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			lastError = new Error(`Google Translate network error: ${message}`)
			continue
		}

		if (!res.ok) {
			lastError = new Error(
				`Google Translate error ${res.status}: ${res.statusText}`,
			)
			continue
		}

		let data: unknown
		try {
			data = await res.json()
		} catch {
			lastError = new Error(
				`Failed to parse Google Translate response (status ${res.status})`,
			)
			continue
		}

		if (!Array.isArray(data) || !Array.isArray(data[0])) {
			lastError = new Error('Unexpected Google Translate response format')
			continue
		}

		const segments: readonly unknown[] = data[0]
		const translated = segments
			.map(seg =>
				Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : '',
			)
			.join('')

		if (!translated) {
			lastError = new Error('Empty response from Google Translate')
			continue
		}

		const detected = typeof data[2] === 'string' ? data[2] : undefined
		return { text: translated, detected }
	}

	throw lastError ?? new Error('Google Translate failed')
}

/** Obtain a bearer auth token for Microsoft Edge Translator. */
export async function fetchMicrosoftToken(force = false): Promise<string> {
	if (
		!force &&
		cachedMsToken &&
		Date.now() - cachedMsToken.at < 8 * 60 * 1000
	) {
		return cachedMsToken.value
	}

	let res: Response
	try {
		res = await fetch('https://edge.microsoft.com/translate/auth', {
			signal: getTimeoutSignal(8000),
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
			},
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(`Microsoft auth network error: ${message}`)
	}

	if (!res.ok) {
		throw new Error(`Microsoft auth error ${res.status}: ${res.statusText}`)
	}

	const value = (await res.text()).trim()
	if (!value) {
		throw new Error('Received empty token from Microsoft auth')
	}

	cachedMsToken = { value, at: Date.now() }
	return value
}

/** Translate text using direct Edge Translator endpoint (no token required). */
export async function edgeDirectTranslate(
	text: string,
	source: string,
	target: string,
): Promise<TranslationResult> {
	const trimmed = text.trim()
	if (!trimmed) {
		throw new Error('No text to translate')
	}

	const enc = encodeURIComponent
	const url = `https://edge.microsoft.com/translate/translatetext?to=${enc(msCode(target))}${source === 'auto' ? '' : `&from=${enc(msCode(source))}`}`

	let res: Response
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify([trimmed]),
			signal: getTimeoutSignal(),
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(`Edge Direct Translate network error: ${message}`)
	}

	if (!res.ok) {
		throw new Error(
			`Edge Direct Translate error ${res.status}: ${res.statusText}`,
		)
	}

	let data: unknown
	try {
		data = await res.json()
	} catch {
		throw new Error(
			`Failed to parse Edge Direct response (status ${res.status})`,
		)
	}

	if (
		!Array.isArray(data) ||
		data.length === 0 ||
		typeof data[0] !== 'object' ||
		data[0] === null
	) {
		throw new Error('Unexpected Edge Direct response format')
	}

	const item = data[0] as {
		detectedLanguage?: { language?: string }
		translations?: Array<{ text?: string }>
	}

	const translated = item.translations?.[0]?.text
	if (typeof translated !== 'string') {
		throw new Error('Unexpected Edge Direct response structure')
	}

	const detected = item.detectedLanguage?.language
	return { text: translated, detected }
}

/** Translate text using Microsoft Cognitive Services / Edge Translator. */
export async function microsoftTranslate(
	text: string,
	source: string,
	target: string,
): Promise<TranslationResult> {
	// Try direct endpoint first (fast, reliable, no token needed)
	try {
		return await edgeDirectTranslate(text, source, target)
	} catch {
		// Fall back to token-based cognitive services API
	}

	const trimmed = text.trim()
	if (!trimmed) {
		throw new Error('No text to translate')
	}

	const enc = encodeURIComponent
	const url = `https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${enc(msCode(target))}${source === 'auto' ? '' : `&from=${enc(msCode(source))}`}`

	const callApi = async (token: string): Promise<Response> => {
		return await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify([{ Text: trimmed }]),
			signal: getTimeoutSignal(),
		})
	}

	let token: string
	try {
		token = await fetchMicrosoftToken(false)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(`Microsoft token acquisition failed: ${message}`)
	}

	let res: Response
	try {
		res = await callApi(token)
		if (res.status === 401) {
			token = await fetchMicrosoftToken(true)
			res = await callApi(token)
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(`Microsoft Translate network error: ${message}`)
	}

	if (!res.ok) {
		throw new Error(
			`Microsoft Translate error ${res.status}: ${res.statusText}`,
		)
	}

	let data: unknown
	try {
		data = await res.json()
	} catch {
		throw new Error(
			`Failed to parse Microsoft Translate response (status ${res.status})`,
		)
	}

	if (
		!Array.isArray(data) ||
		data.length === 0 ||
		typeof data[0] !== 'object' ||
		data[0] === null
	) {
		throw new Error('Unexpected Microsoft Translate response format')
	}

	const item = data[0] as {
		detectedLanguage?: { language?: string }
		translations?: Array<{ text?: string }>
	}

	const translated = item.translations?.[0]?.text
	if (typeof translated !== 'string') {
		throw new Error('Unexpected Microsoft Translate response structure')
	}

	const detected = item.detectedLanguage?.language
	return { text: translated, detected }
}

/** Translate text using MyMemory Translate free REST endpoint. */
export async function mymemoryTranslate(
	text: string,
	source: string,
	target: string,
): Promise<TranslationResult> {
	const trimmed = text.trim()
	if (!trimmed) {
		throw new Error('No text to translate')
	}

	const enc = encodeURIComponent
	const langpair = `${source === 'auto' ? 'autodetect' : source}|${target}`
	const url = `https://api.mymemory.translated.net/get?q=${enc(trimmed)}&langpair=${enc(langpair)}`

	let res: Response
	try {
		res = await fetch(url, { signal: getTimeoutSignal() })
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(`MyMemory Translate network error: ${message}`)
	}

	if (!res.ok) {
		throw new Error(`MyMemory Translate error ${res.status}: ${res.statusText}`)
	}

	let data: unknown
	try {
		data = await res.json()
	} catch {
		throw new Error(`Failed to parse MyMemory response (status ${res.status})`)
	}

	if (
		typeof data !== 'object' ||
		data === null ||
		!('responseData' in data) ||
		typeof (data as { responseData: unknown }).responseData !== 'object' ||
		(data as { responseData: unknown }).responseData === null
	) {
		throw new Error('Unexpected MyMemory response format')
	}

	const record = data as {
		responseData: { translatedText?: unknown }
		responseStatus?: unknown
		quotaFinished?: unknown
	}

	if (record.quotaFinished === true) {
		throw new Error('MyMemory quota exceeded')
	}

	const translated = record.responseData.translatedText
	if (typeof translated !== 'string' || !translated) {
		throw new Error('MyMemory quota exceeded or empty response')
	}

	const upper = translated.toUpperCase()
	if (
		upper.includes('MYMEMORY WARNING') ||
		upper.includes('DAILY LIMIT REACHED')
	) {
		throw new Error('MyMemory quota exceeded or empty response')
	}

	return { text: translated }
}

/** Public mirror instances for Lingva Translate. */
export const LINGVA_INSTANCES: readonly string[] = [
	'lingva.ml',
	'lingva.garudalinux.org',
	'translate.plausibility.cloud',
	'translate.projectsegfau.lt',
]

/** Translate text using Lingva Translate open-source REST API. */
export async function lingvaTranslate(
	text: string,
	source: string,
	target: string,
	instance = 'lingva.ml',
): Promise<TranslationResult> {
	const trimmed = text.trim()
	if (!trimmed) {
		throw new Error('No text to translate')
	}

	const rawHost = instance.replace(/^https?:\/\//, '').replace(/\/+$/, '')
	const host = rawHost || 'lingva.ml'
	const enc = encodeURIComponent
	const url = `https://${host}/api/v1/${enc(source)}/${enc(target)}/${enc(trimmed)}`

	let res: Response
	try {
		res = await fetch(url, { signal: getTimeoutSignal() })
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(`Lingva Translate network error: ${message}`)
	}

	if (!res.ok) {
		let errorMsg = `Lingva Translate error ${res.status}: ${res.statusText}`
		try {
			const errData: unknown = await res.json()
			if (
				typeof errData === 'object' &&
				errData !== null &&
				'error' in errData &&
				typeof (errData as { error?: unknown }).error === 'string'
			) {
				errorMsg = `Lingva error: ${(errData as { error: string }).error}`
			}
		} catch {
			// keep status error
		}
		throw new Error(errorMsg)
	}

	let data: unknown
	try {
		data = await res.json()
	} catch {
		throw new Error(
			`Failed to parse Lingva Translate response (status ${res.status})`,
		)
	}

	if (
		typeof data !== 'object' ||
		data === null ||
		!('translation' in data) ||
		typeof (data as { translation: unknown }).translation !== 'string'
	) {
		if (
			typeof data === 'object' &&
			data !== null &&
			'error' in data &&
			typeof (data as { error?: unknown }).error === 'string'
		) {
			throw new Error(`Lingva error: ${(data as { error: string }).error}`)
		}
		throw new Error('Unexpected Lingva Translate response format')
	}

	const translated = (data as { translation: string }).translation
	let detected: string | undefined
	if (typeof data === 'object' && data !== null && 'info' in data) {
		const info = (data as { info?: unknown }).info
		if (typeof info === 'object' && info !== null && 'detected' in info) {
			const det = (info as { detected?: unknown }).detected
			if (typeof det === 'object' && det !== null && 'code' in det) {
				const code = (det as { code?: unknown }).code
				if (typeof code === 'string') {
					detected = code
				}
			}
		}
	}

	return { text: translated, detected }
}

/** Translate text with automatic Lingva instance failover. */
export async function lingvaTranslateWithFallback(
	text: string,
	source: string,
	target: string,
	preferredInstance?: string,
): Promise<TranslationResult> {
	const candidates: string[] = []
	if (preferredInstance) {
		candidates.push(preferredInstance)
	}
	for (const inst of LINGVA_INSTANCES) {
		if (!candidates.includes(inst)) {
			candidates.push(inst)
		}
	}

	const errors: string[] = []
	for (const inst of candidates) {
		try {
			return await lingvaTranslate(text, source, target, inst)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			errors.push(`${inst}: ${message}`)
		}
	}

	throw new Error(`All Lingva instances failed: ${errors.join('; ')}`)
}

/** Translate text using Brave Translate (with support for nested 3D Chromium arrays and clean error rejection). */
export async function braveTranslate(
	text: string,
	source: string,
	target: string,
): Promise<TranslationResult> {
	const trimmed = text.trim()
	if (!trimmed) {
		throw new Error('No text to translate')
	}

	const enc = encodeURIComponent
	const url = `https://translate.brave.com/translate_a/t?anno=3&client=te_lib&format=text&v=1.0&sl=${enc(source)}&tl=${enc(target)}&tc=1&sr=1&mode=1`

	let res: Response
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
			},
			body: `q=${enc(trimmed)}`,
			signal: getTimeoutSignal(),
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(`Brave Translate network error: ${message}`)
	}

	if (!res.ok) {
		throw new Error(`Brave Translate error ${res.status}: ${res.statusText}`)
	}

	let data: unknown
	try {
		data = await res.json()
	} catch {
		throw new Error(
			`Failed to parse Brave Translate response (status ${res.status})`,
		)
	}

	let translated = ''
	let detected: string | undefined

	if (Array.isArray(data)) {
		if (typeof data[2] === 'string') {
			detected = data[2]
		}
		const first = data[0]
		if (Array.isArray(first)) {
			if (first.length > 0 && Array.isArray(first[0])) {
				// 3D array format: [[["translated", "original", ...]], null, "en"]
				translated = first
					.map(seg =>
						Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : '',
					)
					.join('')
			} else if (typeof first[0] === 'string') {
				// 2D array format: [["translated", "en"]]
				translated = first[0]
				if (typeof first[1] === 'string' && !detected) {
					detected = first[1]
				}
			}
		} else if (typeof first === 'string') {
			translated = first
			if (typeof data[1] === 'string' && !detected) {
				detected = data[1]
			}
		}
	}

	if (!translated) {
		throw new Error('Unexpected Brave Translate response')
	}

	return { text: translated, detected }
}

/** Unified entrypoint for translating text with automatic fallback across providers. */
export async function translateText(
	provider: TranslationProvider,
	text: string,
	source: string,
	target: string,
	options?: { lingvaInstance?: string },
): Promise<TranslationResult & { usedProvider?: TranslationProvider }> {
	const trimmed = text.trim()
	if (!trimmed) {
		throw new Error('No text to translate')
	}

	const lingvaFn = (t: string, s: string, tg: string) =>
		lingvaTranslateWithFallback(t, s, tg, options?.lingvaInstance)

	const providerFns: Record<
		TranslationProvider,
		(t: string, s: string, tg: string) => Promise<TranslationResult>
	> = {
		google: googleTranslate,
		microsoft: microsoftTranslate,
		mymemory: mymemoryTranslate,
		brave: braveTranslate,
		lingva: lingvaFn,
	}

	const allProviders: readonly TranslationProvider[] = [
		'google',
		'microsoft',
		'lingva',
		'mymemory',
		'brave',
	]
	const fallbackChain: TranslationProvider[] = [
		provider,
		...allProviders.filter(p => p !== provider),
	]

	const errors: string[] = []

	for (const candidate of fallbackChain) {
		const fn = providerFns[candidate]
		try {
			const res = await fn(trimmed, source, target)
			return { ...res, usedProvider: candidate }
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			errors.push(`${candidate}: ${message}`)
		}
	}

	throw new Error(`All translation providers failed: ${errors.join('; ')}`)
}
