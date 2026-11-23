export interface RgbColor {
	r: number
	g: number
	b: number
}

export interface HsvColor {
	h: number
	s: number
	v: number
}

export interface HslColor {
	h: number
	s: number
	l: number
}

export function hsvToRgb(h: number, s: number, v: number): RgbColor {
	const safeH = ((h % 360) + 360) % 360
	const safeS = Math.max(0, Math.min(1, s))
	const safeV = Math.max(0, Math.min(1, v))

	const f = (n: number) => {
		const k = (n + safeH / 60) % 6
		return safeV - safeV * safeS * Math.max(Math.min(k, 4 - k, 1), 0)
	}

	return {
		r: Math.round(f(5) * 255),
		g: Math.round(f(3) * 255),
		b: Math.round(f(1) * 255),
	}
}

export function rgbToHsv(r: number, g: number, b: number): HsvColor {
	const rn = Math.max(0, Math.min(255, r)) / 255
	const gn = Math.max(0, Math.min(255, g)) / 255
	const bn = Math.max(0, Math.min(255, b)) / 255

	const max = Math.max(rn, gn, bn)
	const min = Math.min(rn, gn, bn)
	const d = max - min

	let h = 0
	const s = max === 0 ? 0 : d / max
	const v = max

	if (max !== min) {
		switch (max) {
			case rn:
				h = (gn - bn) / d + (gn < bn ? 6 : 0)
				break
			case gn:
				h = (bn - rn) / d + 2
				break
			case bn:
				h = (rn - gn) / d + 4
				break
		}
		h /= 6
	}

	return {
		h: Math.round(h * 360),
		s,
		v,
	}
}

export function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (n: number) =>
		Math.max(0, Math.min(255, Math.round(n)))
			.toString(16)
			.padStart(2, '0')
			.toUpperCase()

	return `#${clamp(r)}${clamp(g)}${clamp(b)}`
}

export function hexToRgb(hex: string): RgbColor | null {
	const clean = hex.trim().replace(/^#/, '')
	if (clean.length === 3) {
		const r = Number.parseInt(clean[0] + clean[0], 16)
		const g = Number.parseInt(clean[1] + clean[1], 16)
		const b = Number.parseInt(clean[2] + clean[2], 16)
		if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
		return { r, g, b }
	}
	if (clean.length >= 6) {
		const r = Number.parseInt(clean.slice(0, 2), 16)
		const g = Number.parseInt(clean.slice(2, 4), 16)
		const b = Number.parseInt(clean.slice(4, 6), 16)
		if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
		return { r, g, b }
	}
	return null
}

export function rgbToHsl(r: number, g: number, b: number): HslColor {
	const rn = Math.max(0, Math.min(255, r)) / 255
	const gn = Math.max(0, Math.min(255, g)) / 255
	const bn = Math.max(0, Math.min(255, b)) / 255

	const max = Math.max(rn, gn, bn)
	const min = Math.min(rn, gn, bn)
	const l = (max + min) / 2
	let h = 0
	let s = 0

	if (max !== min) {
		const d = max - min
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
		switch (max) {
			case rn:
				h = (gn - bn) / d + (gn < bn ? 6 : 0)
				break
			case gn:
				h = (bn - rn) / d + 2
				break
			case bn:
				h = (rn - gn) / d + 4
				break
		}
		h /= 6
	}

	return {
		h: Math.round(h * 360),
		s: Math.round(s * 100),
		l: Math.round(l * 100),
	}
}

export function getLuminance(r: number, g: number, b: number): number {
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export function getContrastColor(hex: string): '#000000' | '#FFFFFF' {
	const rgb = hexToRgb(hex)
	if (!rgb) return '#FFFFFF'
	return getLuminance(rgb.r, rgb.g, rgb.b) > 0.6 ? '#000000' : '#FFFFFF'
}
