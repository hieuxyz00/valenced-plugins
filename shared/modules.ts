import { getModules, lookupModule } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import type { Metro } from '@valenced/modules/types'

export function findByProps<T extends object>(
	...props: [keyof T & string, ...(keyof T & string)[]]
): T | undefined {
	const [mod, id] = lookupModule(withProps<T>(...props))
	if (id === undefined) return undefined
	return mod
}

export function findByName<T extends object>(name: string): T | undefined {
	const [mod, id] = lookupModule(withName<T>(name))
	if (id === undefined) return undefined
	return mod
}

export function onModuleByProps<T extends object>(
	props: [keyof T & string, ...(keyof T & string)[]],
	callback: (mod: T, id: Metro.ModuleID) => undefined | (() => void),
	max = 1,
): () => void {
	const cleanups: Array<() => void> = []
	const unsub = getModules(
		withProps<T>(...props),
		(mod, id) => {
			try {
				const teardown = callback(mod, id)
				if (typeof teardown === 'function') {
					cleanups.push(teardown)
				}
			} catch {}
		},
		{ max },
	)
	return () => {
		unsub()
		for (const fn of cleanups) {
			try {
				fn()
			} catch {}
		}
	}
}

export function onModuleByName<T extends object>(
	name: string,
	callback: (mod: T, id: Metro.ModuleID) => undefined | (() => void),
	max = 1,
): () => void {
	const cleanups: Array<() => void> = []
	const unsub = getModules(
		withName<T>(name),
		(mod, id) => {
			try {
				const teardown = callback(mod, id)
				if (typeof teardown === 'function') {
					cleanups.push(teardown)
				}
			} catch {}
		},
		{ max },
	)
	return () => {
		unsub()
		for (const fn of cleanups) {
			try {
				fn()
			} catch {}
		}
	}
}

export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message
	if (typeof error === 'string') return error
	if (error && typeof error === 'object' && 'message' in error) {
		const msg = (error as { message?: unknown }).message
		if (typeof msg === 'string') return msg
	}
	return String(error)
}
