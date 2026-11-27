import * as nativeModule from '@valenced/modules/native'

export function unwrapNativeResult<T>(raw: unknown): T | null {
	if (raw === null || raw === undefined) return null
	if (typeof raw === 'object') {
		const obj = raw as Record<string, unknown>
		if ('error' in obj && obj.error) {
			return null
		}
		if ('result' in obj) {
			return unwrapNativeResult<T>(obj.result)
		}
	}
	return raw as T
}

export async function callNativeSafe<T>(
	name: string,
	args: unknown[] = [],
): Promise<T | null> {
	try {
		const fn = nativeModule.callNativeMethod as unknown as (
			n: string,
			a: unknown[],
		) => Promise<unknown>
		if (typeof fn === 'function') {
			const raw = await fn(name, args)
			return unwrapNativeResult<T>(raw)
		}
		return null
	} catch {
		return null
	}
}

export function callNativeSyncSafe<T>(
	name: string,
	args: unknown[] = [],
): T | null {
	try {
		const fn = (
			nativeModule as unknown as {
				callNativeMethodSync?: (n: string, a: unknown[]) => unknown
			}
		).callNativeMethodSync
		if (typeof fn === 'function') {
			const raw = fn(name, args)
			return unwrapNativeResult<T>(raw)
		}
		return null
	} catch {
		return null
	}
}

export function reloadDiscordApp(): void {
	try {
		callNativeSyncSafe('valenced.app.reload', [])
	} catch {
		void callNativeSafe('valenced.app.reload', [])
	}
}
