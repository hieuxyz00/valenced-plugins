import { getModules, lookupModule } from '@valenced/modules/finders'
import {
	createFilterGenerator,
	FilterScopes,
} from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { createElement } from 'react'
import { StyleSheet, View } from 'react-native'
import { DiscoveryGuildsBarItem } from '../components/DiscoveryGuildsBarItem'
import type { JsonStorage } from '@valenced/json-storage'
import type { ReactElement } from 'react'
import type { Settings } from '../types'

interface ComponentModule {
	default?: (...args: unknown[]) => ReactElement | null
}

function matchComponent(name: string, exports?: unknown): boolean {
	if (
		!exports ||
		(typeof exports !== 'object' && typeof exports !== 'function')
	) {
		return false
	}
	const targets = [
		exports,
		(exports as Record<string, unknown>).default,
		(exports as Record<string, unknown>)[name],
	]
	for (const target of targets) {
		if (!target) continue
		const t = target as {
			name?: string
			displayName?: string
			type?: { name?: string; displayName?: string }
		}
		if (t.name === name || t.displayName === name) return true
		if (t.type?.name === name || t.type?.displayName === name) return true
	}
	return false
}

const withComponentName = createFilterGenerator<[name: string]>(
	([name], _id, exports) => matchComponent(name, exports),
	([name]) => `valenced.componentName(${name})`,
	FilterScopes.Initialized,
)

export function patchGuildsBar(
	storage: JsonStorage<Settings>,
	cleanup: (...fns: Array<() => void>) => void,
): void {
	let isPatched = false

	function applyFooterPatch(mod: ComponentModule): void {
		if (isPatched) return
		const targetObj = mod as unknown as Record<
			string,
			(...args: unknown[]) => unknown
		>
		if (typeof targetObj?.default !== 'function') return

		const unpatch = instead(targetObj, 'default', function (args, orig) {
			const footerElement = Reflect.apply(
				orig,
				this,
				args,
			) as ReactElement | null
			if (!footerElement) {
				return footerElement
			}
			return createElement(
				View,
				{ style: styles.footerContainer },
				footerElement,
				createElement(DiscoveryGuildsBarItem, {
					key: 'valenced-discovery-compass-item',
					storage,
				}),
			)
		})
		cleanup(unpatch)
		isPatched = true
	}

	try {
		const [footerMod, footerId] = lookupModule(
			withComponentName('GuildsBarFooterWrapper'),
			{ returnNamespace: true },
		)
		if (footerId !== undefined && footerMod) {
			applyFooterPatch(footerMod as ComponentModule)
		}
	} catch {}

	if (!isPatched) {
		try {
			const unsubscribe = getModules(
				withComponentName('GuildsBarFooterWrapper'),
				(mod: unknown) => {
					applyFooterPatch(mod as ComponentModule)
				},
				{ returnNamespace: true },
			)
			cleanup(unsubscribe)
		} catch {}
	}
}

const styles = StyleSheet.create({
	footerContainer: {
		alignItems: 'center',
		justifyContent: 'center',
	},
})
