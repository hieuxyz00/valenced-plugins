import { lookupModule } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { createElement } from 'react'
import { ServerDiscoveryTab } from '../components/ServerDiscoveryTab'
import { useDiscoveryActive } from '../state/discoveryState'
import type { JsonStorage } from '@valenced/json-storage'
import type { ComponentType } from 'react'
import type { Settings } from '../types'

interface MemoComponent {
	type?: (...args: unknown[]) => unknown
	$$typeof?: symbol
}

function patchTargetComponent(
	target: Record<string, unknown>,
	propName: string,
	storage: JsonStorage<Settings>,
	cleanup: (...fns: Array<() => void>) => void,
): boolean {
	const exported = target[propName]
	if (!exported) return false

	if (
		typeof exported === 'object' &&
		exported !== null &&
		'type' in exported &&
		typeof (exported as MemoComponent).type === 'function'
	) {
		const memo = exported as MemoComponent
		const unpatch = instead(
			memo as unknown as Record<string, (...args: unknown[]) => unknown>,
			'type',
			function GuildsOnlyDiscoveryWrapper(args, orig) {
				const isActive = useDiscoveryActive()
				if (isActive) {
					return createElement(ServerDiscoveryTab, { storage })
				}
				return createElement(
					orig as ComponentType<Record<string, unknown>>,
					(args[0] ?? {}) as Record<string, unknown>,
				)
			},
		)
		cleanup(unpatch)
		return true
	}

	if (typeof exported === 'function') {
		const unpatch = instead(
			target as Record<string, (...args: unknown[]) => unknown>,
			propName,
			function GuildsOnlyDiscoveryWrapper(args, orig) {
				const isActive = useDiscoveryActive()
				if (isActive) {
					return createElement(ServerDiscoveryTab, { storage })
				}
				return createElement(
					orig as ComponentType<Record<string, unknown>>,
					(args[0] ?? {}) as Record<string, unknown>,
				)
			},
		)
		cleanup(unpatch)
		return true
	}

	return false
}

export function patchDiscoveryView(
	storage: JsonStorage<Settings>,
	cleanup: (...fns: Array<() => void>) => void,
): void {
	let guildsOnlyMod: Record<string, unknown> | undefined

	if (typeof __r === 'function') {
		try {
			const mod17403 = __r(17403) as Record<string, unknown>
			const def = mod17403?.default as
				| { type?: { name?: string }; name?: string }
				| undefined
			if (def?.type?.name === 'GuildsOnly' || def?.name === 'GuildsOnly') {
				guildsOnlyMod = mod17403
			} else if (
				typeof mod17403 === 'function' &&
				((mod17403 as { name?: string }).name === 'GuildsOnly' ||
					(mod17403 as { type?: { name?: string } }).type?.name ===
						'GuildsOnly')
			) {
				guildsOnlyMod = { default: mod17403 }
			}
		} catch {}
	}

	if (!guildsOnlyMod) {
		try {
			const [mod] = lookupModule(
				withName<Record<string, unknown>>('GuildsOnly'),
				{ returnNamespace: true },
			)
			if (mod) {
				guildsOnlyMod = mod
			}
		} catch {}
	}

	if (!guildsOnlyMod && typeof valenced !== 'undefined') {
		const getExports = (
			valenced as unknown as {
				modules?: {
					metro?: {
						getInitializedModuleExports?: (
							id: number,
						) => Record<string, unknown>
					}
				}
			}
		)?.modules?.metro?.getInitializedModuleExports
		if (typeof getExports === 'function') {
			for (let id = 17000; id < 18000; id++) {
				try {
					const exp = getExports(id)
					const def = exp?.default as
						| { type?: { name?: string }; name?: string }
						| undefined
					if (def?.type?.name === 'GuildsOnly' || def?.name === 'GuildsOnly') {
						guildsOnlyMod = exp
						break
					} else if (
						typeof exp === 'function' &&
						((exp as { name?: string }).name === 'GuildsOnly' ||
							(exp as { type?: { name?: string } }).type?.name === 'GuildsOnly')
					) {
						guildsOnlyMod = { default: exp }
						break
					}
				} catch {}
			}
		}
	}

	if (guildsOnlyMod) {
		let patched = patchTargetComponent(
			guildsOnlyMod,
			'default',
			storage,
			cleanup,
		)
		if (!patched && guildsOnlyMod.GuildsOnly) {
			patched = patchTargetComponent(
				guildsOnlyMod,
				'GuildsOnly',
				storage,
				cleanup,
			)
		}
		if (patched) return
	}

	try {
		let [channelsMod, channelsId] = lookupModule(
			withProps<Record<string, unknown>>('ChannelList'),
			{ returnNamespace: true },
		)
		if (!channelsMod && typeof __r === 'function') {
			try {
				channelsMod = __r(17493) as Record<string, unknown>
				channelsId = 17493
			} catch {}
		}

		if (channelsId !== undefined && channelsMod) {
			const modRecord = channelsMod as Record<string, unknown>
			patchTargetComponent(modRecord, 'default', storage, cleanup)

			const defExport = modRecord.default
			const clExport = modRecord.ChannelList
			const isDuplicate =
				clExport === defExport ||
				(typeof clExport === 'object' &&
					clExport !== null &&
					typeof defExport === 'object' &&
					defExport !== null &&
					'type' in clExport &&
					'type' in defExport &&
					(clExport as MemoComponent).type ===
						(defExport as MemoComponent).type)

			if (!isDuplicate && clExport) {
				patchTargetComponent(modRecord, 'ChannelList', storage, cleanup)
			}
		}
	} catch {}
}
