import { getModules, lookupModule } from '@valenced/modules/finders'
import {
	createFilterGenerator,
	FilterScopes,
	withProps,
} from '@valenced/modules/finders/filters'
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
	let channelFramePatched = false
	function applyChannelFramePatch(mod: Record<string, unknown>): void {
		if (channelFramePatched) return
		let patched = patchChannelFrameComponent(mod, 'default', cleanup)
		if (!patched && mod.ChannelScreenAnimatedFrame) {
			patched = patchChannelFrameComponent(
				mod,
				'ChannelScreenAnimatedFrame',
				cleanup,
			)
		}
		if (patched) channelFramePatched = true
	}

	try {
		const [mod] = lookupModule(
			withComponentName('ChannelScreenAnimatedFrame'),
			{ returnNamespace: true },
		)
		if (mod) applyChannelFramePatch(mod as Record<string, unknown>)
	} catch {}

	if (!channelFramePatched) {
		try {
			const unsubscribe = getModules(
				withComponentName('ChannelScreenAnimatedFrame'),
				(mod: unknown) => {
					applyChannelFramePatch(mod as Record<string, unknown>)
				},
				{ returnNamespace: true },
			)
			cleanup(unsubscribe)
		} catch {}
	}

	let mainTabsPatched = false
	function applyMainTabsPatch(mod: Record<string, unknown>): void {
		if (mainTabsPatched) return
		let patched = patchTargetComponent(mod, 'default', storage, cleanup)
		if (!patched && mod.MainTabs) {
			patched = patchTargetComponent(mod, 'MainTabs', storage, cleanup)
		}
		if (patched) mainTabsPatched = true
	}

	try {
		const [mod] = lookupModule(withComponentName('MainTabs'), {
			returnNamespace: true,
		})
		if (mod) applyMainTabsPatch(mod as Record<string, unknown>)
	} catch {}

	if (!mainTabsPatched) {
		try {
			const unsubscribe = getModules(
				withComponentName('MainTabs'),
				(mod: unknown) => {
					applyMainTabsPatch(mod as Record<string, unknown>)
				},
				{ returnNamespace: true },
			)
			cleanup(unsubscribe)
		} catch {}
	}

	let guildsOnlyPatched = false
	function applyGuildsOnlyPatch(mod: Record<string, unknown>): void {
		if (guildsOnlyPatched) return
		let patched = patchTargetComponent(mod, 'default', storage, cleanup)
		if (!patched && mod.GuildsOnly) {
			patched = patchTargetComponent(mod, 'GuildsOnly', storage, cleanup)
		}
		if (patched) guildsOnlyPatched = true
	}

	try {
		const [mod] = lookupModule(withComponentName('GuildsOnly'), {
			returnNamespace: true,
		})
		if (mod) applyGuildsOnlyPatch(mod as Record<string, unknown>)
	} catch {}

	if (!guildsOnlyPatched) {
		try {
			const unsubscribe = getModules(
				withComponentName('GuildsOnly'),
				(mod: unknown) => {
					applyGuildsOnlyPatch(mod as Record<string, unknown>)
				},
				{ returnNamespace: true },
			)
			cleanup(unsubscribe)
		} catch {}
	}

	if (!mainTabsPatched && !guildsOnlyPatched) {
		try {
			const [channelsMod, channelsId] = lookupModule(
				withProps<Record<string, unknown>>('ChannelList'),
				{ returnNamespace: true },
			)

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
