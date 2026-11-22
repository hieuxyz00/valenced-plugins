import { Stores } from '@valenced/discord/flux'
import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import React, { useSyncExternalStore } from 'react'

let active = false
const listeners = new Set<() => void>()
let resetTrackingState: (() => void) | undefined

function notifyListeners(): void {
	for (const listener of listeners) {
		try {
			listener()
		} catch {}
	}
}

interface DrawerModule {
	setHomeDrawerState?: (open: boolean) => void
}

interface SelectedGuildStoreType {
	getGuildId?: () => string | null | undefined
	addChangeListener?: (listener: () => void) => void
	removeChangeListener?: (listener: () => void) => void
}

function getDrawerModule(): DrawerModule | undefined {
	try {
		const [mod] = lookupModule(withProps<DrawerModule>('setHomeDrawerState'))
		if (typeof mod?.setHomeDrawerState === 'function') return mod
	} catch {}
	if (typeof __r === 'function') {
		try {
			const mod = __r(5148) as DrawerModule
			if (typeof mod?.setHomeDrawerState === 'function') return mod
		} catch {}
	}
	return undefined
}

export const DiscoveryState = {
	get isActive(): boolean {
		return active
	},
	setActive(nextActive: boolean): void {
		if (active === nextActive) return
		active = nextActive
		if (nextActive && resetTrackingState) {
			resetTrackingState()
		}
		notifyListeners()
	},
	subscribe(listener: () => void): () => void {
		listeners.add(listener)
		return () => {
			listeners.delete(listener)
		}
	},
	closeDrawer(): void {
		try {
			const mod = getDrawerModule()
			if (typeof mod?.setHomeDrawerState === 'function') {
				mod.setHomeDrawerState(false)
			}
		} catch {}
	},
	openDrawer(): void {
		try {
			const mod = getDrawerModule()
			if (typeof mod?.setHomeDrawerState === 'function') {
				mod.setHomeDrawerState(true)
			}
		} catch {}
	},
}

const getDiscoveryActiveSnapshot = (): boolean => DiscoveryState.isActive
const getDiscoveryActiveServerSnapshot = (): boolean => false

function isInsideReactRender(): boolean {
	const internals = React as unknown as {
		__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: {
			H?: unknown
		}
		__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: {
			ReactCurrentDispatcher?: { current?: unknown }
		}
	}
	return Boolean(
		internals?.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
			?.H ??
			internals?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
				?.ReactCurrentDispatcher?.current,
	)
}

export function useDiscoveryActive(): boolean {
	if (!isInsideReactRender()) {
		return DiscoveryState.isActive
	}
	try {
		return useSyncExternalStore(
			DiscoveryState.subscribe,
			getDiscoveryActiveSnapshot,
			getDiscoveryActiveServerSnapshot,
		)
	} catch {
		return DiscoveryState.isActive
	}
}

export function initGuildChangeListener(
	cleanup: (...fns: Array<() => void>) => void,
): void {
	const guildStore = Stores.SelectedGuildStore as
		| SelectedGuildStoreType
		| undefined

	let lastGuildId = guildStore?.getGuildId?.() ?? null

	resetTrackingState = () => {
		lastGuildId = guildStore?.getGuildId?.() ?? null
	}

	const handleExitDiscovery = (): void => {
		if (DiscoveryState.isActive) {
			DiscoveryState.setActive(false)
		}
	}

	const handleStoreChange = (): void => {
		if (!DiscoveryState.isActive) return
		const currentGuildId = guildStore?.getGuildId?.() ?? null

		if (currentGuildId !== lastGuildId) {
			lastGuildId = currentGuildId
			handleExitDiscovery()
		}
	}

	try {
		guildStore?.addChangeListener?.(handleStoreChange)

		cleanup(() => {
			guildStore?.removeChangeListener?.(handleStoreChange)
			if (resetTrackingState) {
				resetTrackingState = undefined
			}
		})
	} catch {}
}
