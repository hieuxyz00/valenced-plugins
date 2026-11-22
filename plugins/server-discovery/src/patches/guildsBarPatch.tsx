import { lookupModule } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { createElement } from 'react'
import { StyleSheet, View } from 'react-native'
import { DiscoveryGuildsBarItem } from '../components/DiscoveryGuildsBarItem'
import type { JsonStorage } from '@valenced/json-storage'
import type { ReactElement } from 'react'
import type { Settings } from '../types'

interface ComponentModule {
	default?: (props: unknown) => ReactElement | null
}

export function patchGuildsBar(
	storage: JsonStorage<Settings>,
	cleanup: (...fns: Array<() => void>) => void,
): void {
	try {
		let [footerMod, footerId] = lookupModule(
			withName<ComponentModule>('GuildsBarFooterWrapper'),
			{ returnNamespace: true },
		)

		if (
			(!footerMod || typeof footerMod.default !== 'function') &&
			typeof __r === 'function'
		) {
			try {
				footerMod = __r(17757) as ComponentModule
				footerId = 17757
			} catch {}
		}

		if (footerId !== undefined && typeof footerMod?.default === 'function') {
			const targetObj = footerMod as unknown as Record<
				string,
				(...args: unknown[]) => unknown
			>

			const unpatchFooter = instead(
				targetObj,
				'default',
				function (args, orig) {
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
				},
			)
			cleanup(unpatchFooter)
		}
	} catch {}
}

const styles = StyleSheet.create({
	footerContainer: {
		alignItems: 'center',
		justifyContent: 'center',
	},
})
