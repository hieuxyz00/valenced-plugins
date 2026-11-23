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
	type?: unknown
	$$typeof?: symbol
}

interface ForwardRefComponent {
	render?: (...args: unknown[]) => unknown
	$$typeof?: symbol
}

function resolveComponentTarget(
	target: Record<string, unknown>,
	propName: string,
): [Record<string, (...args: unknown[]) => unknown>, string] | null {
	let exported = target[propName]
	if (!exported) {
		if (propName === 'default') {
			exported = target
		} else {
			return null
		}
	}

	if (typeof exported === 'object' && exported !== null) {
		const memo = exported as MemoComponent
		if (
			'type' in memo &&
			typeof memo.type === 'object' &&
			memo.type !== null &&
			'render' in (memo.type as ForwardRefComponent) &&
			typeof (memo.type as ForwardRefComponent).render === 'function'
		) {
			return [
				memo.type as unknown as Record<string, (...args: unknown[]) => unknown>,
				'render',
			]
		}
		if ('type' in memo && typeof memo.type === 'function') {
			return [
				memo as unknown as Record<string, (...args: unknown[]) => unknown>,
				'type',
			]
		}
		const fwd = exported as ForwardRefComponent
		if ('render' in fwd && typeof fwd.render === 'function') {
			return [
				fwd as unknown as Record<string, (...args: unknown[]) => unknown>,
				'render',
			]
		}
		return null
	}

	if (typeof exported === 'function') {
		return [target as Record<string, (...args: unknown[]) => unknown>, propName]
	}

	return null
}

function patchTargetComponent(
	target: Record<string, unknown>,
	propName: string,
	storage: JsonStorage<Settings>,
	cleanup: (...fns: Array<() => void>) => void,
): boolean {
	const resolved = resolveComponentTarget(target, propName)
	if (!resolved) return false

	const [hostObj, hostProp] = resolved
	const unpatch = instead(
		hostObj,
		hostProp,
		function ServerDiscoveryWrapper(args, orig) {
			const isActive = useDiscoveryActive()
			if (isActive) {
				return createElement(ServerDiscoveryTab, { storage })
			}
			const props = (args[0] ?? {}) as Record<string, unknown>
			const elementProps =
				args[1] !== undefined ? { ...props, ref: args[1] } : props
			return createElement(
				orig as ComponentType<Record<string, unknown>>,
				elementProps,
			)
		},
	)
	cleanup(unpatch)
	return true
}

function patchChannelFrameComponent(
	target: Record<string, unknown>,
	propName: string,
	cleanup: (...fns: Array<() => void>) => void,
): boolean {
	const resolved = resolveComponentTarget(target, propName)
	if (!resolved) return false

	const [hostObj, hostProp] = resolved
	const unpatch = instead(
		hostObj,
		hostProp,
		function ChannelFrameDiscoveryWrapper(args, orig) {
			const isActive = useDiscoveryActive()
			if (isActive) {
				return null
			}
			const props = (args[0] ?? {}) as Record<string, unknown>
			const elementProps =
				args[1] !== undefined ? { ...props, ref: args[1] } : props
			return createElement(
				orig as ComponentType<Record<string, unknown>>,
				elementProps,
			)
		},
	)
	cleanup(unpatch)
	return true
}

export function patchDiscoveryView(
	storage: JsonStorage<Settings>,
	cleanup: (...fns: Array<() => void>) => void,
): void {
	let channelFrameMod: Record<string, unknown> | undefined

	if (typeof __r === 'function') {
		try {
			const mod17393 = __r(17393) as Record<string, unknown>
			const def = mod17393?.default as
				| { type?: { name?: string }; name?: string }
				| undefined
			if (
				def?.type?.name === 'ChannelScreenAnimatedFrame' ||
				def?.name === 'ChannelScreenAnimatedFrame' ||
				mod17393?.ChannelScreenAnimatedFrame
			) {
				channelFrameMod = mod17393
			} else if (
				typeof mod17393 === 'function' &&
				((mod17393 as { name?: string }).name ===
					'ChannelScreenAnimatedFrame' ||
					(mod17393 as { type?: { name?: string } }).type?.name ===
						'ChannelScreenAnimatedFrame')
			) {
				channelFrameMod = { default: mod17393 }
			} else if (mod17393) {
				channelFrameMod = mod17393
			}
		} catch {}
	}

	if (!channelFrameMod) {
		try {
			const [mod] = lookupModule(
				withName<Record<string, unknown>>('ChannelScreenAnimatedFrame'),
				{ returnNamespace: true },
			)
			if (mod) {
				channelFrameMod = mod
			}
		} catch {}
	}

	if (!channelFrameMod) {
		try {
			const [mod] = lookupModule(
				withProps<Record<string, unknown>>('ChannelScreenAnimatedFrame'),
				{ returnNamespace: true },
			)
			if (mod) {
				channelFrameMod = mod
			}
		} catch {}
	}

	if (!channelFrameMod && typeof valenced !== 'undefined') {
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
			for (let id = 17380; id < 17420; id++) {
				try {
					const exp = getExports(id)
					const def = exp?.default as
						| { type?: { name?: string }; name?: string }
						| undefined
					if (
						def?.type?.name === 'ChannelScreenAnimatedFrame' ||
						def?.name === 'ChannelScreenAnimatedFrame' ||
						exp?.ChannelScreenAnimatedFrame
					) {
						channelFrameMod = exp
						break
					} else if (
						typeof exp === 'function' &&
						((exp as { name?: string }).name === 'ChannelScreenAnimatedFrame' ||
							(exp as { type?: { name?: string } }).type?.name ===
								'ChannelScreenAnimatedFrame')
					) {
						channelFrameMod = { default: exp }
						break
					}
				} catch {}
			}
		}
	}

	if (channelFrameMod) {
		let patched = patchChannelFrameComponent(
			channelFrameMod,
			'default',
			cleanup,
		)
		if (!patched && channelFrameMod.ChannelScreenAnimatedFrame) {
			patched = patchChannelFrameComponent(
				channelFrameMod,
				'ChannelScreenAnimatedFrame',
				cleanup,
			)
		}
	}

	let mainTabsMod: Record<string, unknown> | undefined

	if (typeof __r === 'function') {
		try {
			const mod17386 = __r(17386) as Record<string, unknown>
			const def = mod17386?.default as
				| { type?: { name?: string }; name?: string }
				| undefined
			if (
				def?.type?.name === 'MainTabs' ||
				def?.name === 'MainTabs' ||
				mod17386?.MainTabs
			) {
				mainTabsMod = mod17386
			} else if (
				typeof mod17386 === 'function' &&
				((mod17386 as { name?: string }).name === 'MainTabs' ||
					(mod17386 as { type?: { name?: string } }).type?.name === 'MainTabs')
			) {
				mainTabsMod = { default: mod17386 }
			} else if (mod17386) {
				mainTabsMod = mod17386
			}
		} catch {}
	}

	if (!mainTabsMod) {
		try {
			const [mod] = lookupModule(
				withName<Record<string, unknown>>('MainTabs'),
				{ returnNamespace: true },
			)
			if (mod) {
				mainTabsMod = mod
			}
		} catch {}
	}

	if (!mainTabsMod) {
		try {
			const [mod] = lookupModule(
				withProps<Record<string, unknown>>('MainTabs'),
				{ returnNamespace: true },
			)
			if (mod) {
				mainTabsMod = mod
			}
		} catch {}
	}

	if (!mainTabsMod && typeof valenced !== 'undefined') {
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
			for (let id = 17370; id < 17400; id++) {
				try {
					const exp = getExports(id)
					const def = exp?.default as
						| { type?: { name?: string }; name?: string }
						| undefined
					if (
						def?.type?.name === 'MainTabs' ||
						def?.name === 'MainTabs' ||
						exp?.MainTabs
					) {
						mainTabsMod = exp
						break
					} else if (
						typeof exp === 'function' &&
						((exp as { name?: string }).name === 'MainTabs' ||
							(exp as { type?: { name?: string } }).type?.name === 'MainTabs')
					) {
						mainTabsMod = { default: exp }
						break
					}
				} catch {}
			}
		}
	}

	let mainTabsPatched = false
	if (mainTabsMod) {
		mainTabsPatched = patchTargetComponent(
			mainTabsMod,
			'default',
			storage,
			cleanup,
		)
		if (!mainTabsPatched && mainTabsMod.MainTabs) {
			mainTabsPatched = patchTargetComponent(
				mainTabsMod,
				'MainTabs',
				storage,
				cleanup,
			)
		}
	}

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

	let guildsOnlyPatched = false
	if (guildsOnlyMod) {
		guildsOnlyPatched = patchTargetComponent(
			guildsOnlyMod,
			'default',
			storage,
			cleanup,
		)
		if (!guildsOnlyPatched && guildsOnlyMod.GuildsOnly) {
			guildsOnlyPatched = patchTargetComponent(
				guildsOnlyMod,
				'GuildsOnly',
				storage,
				cleanup,
			)
		}
	}

	if (!mainTabsPatched && !guildsOnlyPatched) {
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
}
