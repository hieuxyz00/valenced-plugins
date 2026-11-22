import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import * as ReactNative from 'react-native'

const RN = ReactNative as unknown as {
	Platform: typeof ReactNative.Platform
	StatusBar?: { currentHeight?: number }
}

export interface EdgeInsets {
	top: number
	bottom: number
	left: number
	right: number
}

export type SafeAreaInsetsHook = () => EdgeInsets

interface SafeAreaModule {
	useSafeAreaInsets?: SafeAreaInsetsHook
}

let cachedSafeAreaHook: SafeAreaInsetsHook | undefined

export function resolveSafeAreaInsetsHook(): SafeAreaInsetsHook | null {
	if (typeof cachedSafeAreaHook === 'function') {
		return cachedSafeAreaHook
	}

	try {
		const valencedObj = (globalThis as unknown as Record<string, unknown>)
			.valenced as
			| {
					externals?: {
						ReactNativeSafeAreaContext?: {
							useSafeAreaInsets?: SafeAreaInsetsHook
							ReactNativeSafeAreaContext?: {
								useSafeAreaInsets?: SafeAreaInsetsHook
							}
							default?: {
								useSafeAreaInsets?: SafeAreaInsetsHook
							}
						}
					}
			  }
			| undefined

		const externalHook =
			valencedObj?.externals?.ReactNativeSafeAreaContext
				?.ReactNativeSafeAreaContext?.useSafeAreaInsets ??
			valencedObj?.externals?.ReactNativeSafeAreaContext?.useSafeAreaInsets ??
			valencedObj?.externals?.ReactNativeSafeAreaContext?.default
				?.useSafeAreaInsets

		if (typeof externalHook === 'function') {
			cachedSafeAreaHook = externalHook
			return cachedSafeAreaHook
		}

		const globalHook = (
			(globalThis as unknown as Record<string, unknown>)
				.ReactNativeSafeAreaContext as
				| { useSafeAreaInsets?: SafeAreaInsetsHook }
				| undefined
		)?.useSafeAreaInsets

		if (typeof globalHook === 'function') {
			cachedSafeAreaHook = globalHook
			return cachedSafeAreaHook
		}

		const [module] = lookupModule(
			withProps<SafeAreaModule>('useSafeAreaInsets'),
		)
		const moduleHook =
			module?.useSafeAreaInsets ??
			(module as { default?: { useSafeAreaInsets?: SafeAreaInsetsHook } })
				?.default?.useSafeAreaInsets

		if (typeof moduleHook === 'function') {
			cachedSafeAreaHook = moduleHook
			return cachedSafeAreaHook
		}
	} catch {}

	return null
}

export function resetSafeAreaInsetsHook(): void {
	cachedSafeAreaHook = undefined
}

export function useSafeArea(): EdgeInsets {
	const hook = resolveSafeAreaInsetsHook()
	let insets: EdgeInsets = { top: 0, bottom: 0, left: 0, right: 0 }

	if (hook) {
		try {
			const result = hook()
			if (
				result &&
				Number.isFinite(result.top) &&
				Number.isFinite(result.bottom) &&
				Number.isFinite(result.left) &&
				Number.isFinite(result.right)
			) {
				insets = {
					top: Math.max(0, result.top),
					bottom: Math.max(0, result.bottom),
					left: Math.max(0, result.left),
					right: Math.max(0, result.right),
				}
			}
		} catch {}
	}

	const statusBar =
		RN.StatusBar ??
		((globalThis as unknown as Record<string, unknown>).StatusBar as
			| { currentHeight?: number }
			| undefined)

	const isAndroid =
		(RN.Platform?.OS ??
			(
				(globalThis as unknown as Record<string, unknown>).Platform as
					| { OS?: string }
					| undefined
			)?.OS) === 'android'

	const statusBarHeight = isAndroid
		? Math.max(0, statusBar?.currentHeight ?? 0)
		: 0
	const top = Math.max(insets.top, statusBarHeight)

	return {
		top,
		bottom: insets.bottom,
		left: insets.left,
		right: insets.right,
	}
}
