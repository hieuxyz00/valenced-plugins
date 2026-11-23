import { Stores } from '@valenced/discord/flux'
import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import type {
	DiscoverableGuildsResponse,
	DiscoveryCategory,
	GuildPreview,
} from '../types'

interface HttpModule {
	HTTP: {
		get(options: {
			url: string
			query?: Record<string, unknown>
		}): Promise<{ status: number; body: unknown }>
		put(options: {
			url: string
			body?: Record<string, unknown>
		}): Promise<{ status: number; body: unknown }>
		post(options: {
			url: string
			body?: Record<string, unknown>
		}): Promise<{ status: number; body: unknown }>
	}
}

interface GuildActionsModule {
	joinGuild(
		guildId: string,
		options?: { source?: string; lurker?: boolean },
	): Promise<unknown>
	selectGuild(guildId: string): void
	transitionToGuildSync?(guildId: string): void
}

let cachedCategories: DiscoveryCategory[] | null = null
let categoriesPromise: Promise<DiscoveryCategory[]> | null = null

function getHttpModule(): HttpModule | undefined {
	const [exports] = lookupModule(withProps('HTTP', 'post'))
	if (exports) {
		const typed = exports as unknown as HttpModule
		if (typed.HTTP && typeof typed.HTTP.get === 'function') {
			return typed
		}
	}
	return undefined
}

function getGuildActions(): GuildActionsModule | undefined {
	const [exports] = lookupModule(
		withProps('joinGuild', 'transitionToGuildSync'),
	)
	if (exports) {
		const typed = exports as unknown as GuildActionsModule
		if (typeof typed.joinGuild === 'function') {
			return typed
		}
	}
	const [fallback] = lookupModule(withProps('joinGuild'))
	if (fallback) {
		const typed = fallback as unknown as GuildActionsModule
		if (typeof typed.joinGuild === 'function') {
			return typed
		}
	}
	return undefined
}

export function getCachedDiscoveryCategories(): DiscoveryCategory[] | null {
	return cachedCategories
}

export function clearCachedDiscoveryCategories(): void {
	cachedCategories = null
	categoriesPromise = null
}

export async function fetchDiscoverableGuilds(options: {
	categoryId?: number
	offset?: number
	limit?: number
}): Promise<DiscoverableGuildsResponse> {
	const http = getHttpModule()
	if (!http) {
		throw new Error('HTTP module unavailable')
	}

	const query: Record<string, unknown> = {
		limit: options.limit ?? 24,
		offset: options.offset ?? 0,
	}

	if (options.categoryId !== undefined && options.categoryId >= 0) {
		query.categories = [options.categoryId]
	}

	const response = await http.HTTP.get({
		url: '/discoverable-guilds',
		query,
	})

	const body = response.body as DiscoverableGuildsResponse
	return {
		guilds: Array.isArray(body?.guilds) ? body.guilds : [],
		total: typeof body?.total === 'number' ? body.total : undefined,
		total_count:
			typeof body?.total_count === 'number' ? body.total_count : undefined,
		offset: typeof body?.offset === 'number' ? body.offset : options.offset,
		limit: typeof body?.limit === 'number' ? body.limit : options.limit,
	}
}

export async function searchDiscoverableGuilds(options: {
	query: string
	categoryId?: number
	offset?: number
	limit?: number
}): Promise<DiscoverableGuildsResponse> {
	const http = getHttpModule()
	if (!http) {
		throw new Error('HTTP module unavailable')
	}

	const queryParams: Record<string, unknown> = {
		query: options.query.trim(),
		limit: options.limit ?? 24,
		offset: options.offset ?? 0,
	}

	if (options.categoryId !== undefined && options.categoryId >= 0) {
		queryParams.categories = [options.categoryId]
	}

	const response = await http.HTTP.get({
		url: '/discoverable-guilds/search',
		query: queryParams,
	})

	const body = response.body as DiscoverableGuildsResponse
	return {
		guilds: Array.isArray(body?.guilds) ? body.guilds : [],
		total:
			typeof body?.total_count === 'number' ? body.total_count : body?.total,
		total_count:
			typeof body?.total_count === 'number' ? body.total_count : undefined,
		offset: options.offset ?? 0,
		limit: options.limit ?? 24,
	}
}

export async function fetchDiscoveryCategories(): Promise<DiscoveryCategory[]> {
	if (categoriesPromise) {
		return categoriesPromise
	}

	categoriesPromise = (async () => {
		const http = getHttpModule()
		if (!http) return []

		try {
			const response = await http.HTTP.get({
				url: '/discovery/categories',
			})
			if (Array.isArray(response.body)) {
				const raw = response.body as DiscoveryCategory[]
				const primary = raw.filter(c => Boolean(c.is_primary))
				const nonPrimary = raw.filter(c => !c.is_primary)
				const sortedPrimary = [
					...primary.filter(c => c.id === 0),
					...primary
						.filter(c => c.id !== 0)
						.sort((a, b) => Number(a.id) - Number(b.id)),
				]
				const sortedNonPrimary = [...nonPrimary].sort((a, b) =>
					a.name.localeCompare(b.name),
				)
				const sorted = [...sortedPrimary, ...sortedNonPrimary]
				cachedCategories = sorted
				return sorted
			}
		} catch {}
		return []
	})().finally(() => {
		categoriesPromise = null
	})

	return categoriesPromise
}

export async function fetchGuildPreview(
	guildId: string,
): Promise<GuildPreview | null> {
	const http = getHttpModule()
	if (!http || !guildId) return null

	try {
		const response = await http.HTTP.get({
			url: `/guilds/${guildId}/preview`,
		})
		if (
			response.status === 200 &&
			response.body &&
			typeof response.body === 'object'
		) {
			return response.body as GuildPreview
		}
	} catch {}
	return null
}

export function isGuildJoined(guildId: string): boolean {
	if (!guildId) return false
	try {
		const guildStore = Stores.GuildStore as
			| { getGuild?(id: string): unknown }
			| undefined
		const hasGuild = Boolean(guildStore?.getGuild?.(guildId))
		if (!hasGuild) return false

		const lurkingStore = Stores.LurkingStore as
			| { isLurking?(id: string): boolean }
			| undefined
		if (lurkingStore?.isLurking?.(guildId)) {
			return false
		}
		return true
	} catch {
		return false
	}
}

export async function joinGuild(guildId: string): Promise<boolean> {
	if (!guildId) return false

	const actions = getGuildActions()
	if (actions && typeof actions.joinGuild === 'function') {
		try {
			await actions.joinGuild(guildId, {
				source: 'guild_discovery',
				lurker: false,
			})
			return true
		} catch (err: unknown) {
			const body = (err as { body?: { message?: string } })?.body
			if (body?.message) {
				throw new Error(body.message)
			}
			throw err
		}
	}

	const http = getHttpModule()
	if (http) {
		await http.HTTP.put({
			url: `/guilds/${guildId}/members/@me`,
			body: {},
		})
		return true
	}

	throw new Error('Unable to join server: join action unavailable')
}

export function selectGuild(guildId: string): void {
	if (!guildId) return
	const actions = getGuildActions()
	if (actions?.transitionToGuildSync) {
		try {
			actions.transitionToGuildSync(guildId)
			return
		} catch {}
	}
	if (actions && typeof actions.selectGuild === 'function') {
		try {
			actions.selectGuild(guildId)
			return
		} catch {}
	}
}
