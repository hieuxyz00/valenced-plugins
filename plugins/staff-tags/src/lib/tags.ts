import { Stores } from '@valenced/discord/flux'
import { getModules, lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import type { DiscordModules } from '@valenced/discord/types'
import type {
	CustomTagsConfig,
	DiscordChannel,
	DiscordGuild,
	DiscordGuildMember,
	DiscordPermissionOverwrites,
	DiscordRoleColorStrings,
	DiscordUser,
	Tag,
	TagResult,
} from '../types'

export const KICK_MEMBERS = 1n << 1n
export const BAN_MEMBERS = 1n << 2n
export const ADMINISTRATOR = 1n << 3n
export const MANAGE_CHANNELS = 1n << 4n
export const MANAGE_GUILD = 1n << 5n
export const MANAGE_MESSAGES = 1n << 13n
export const MUTE_MEMBERS = 1n << 22n
export const DEAFEN_MEMBERS = 1n << 23n
export const MOVE_MEMBERS = 1n << 24n
export const MANAGE_ROLES = 1n << 28n
export const MANAGE_WEBHOOKS = 1n << 29n
export const MODERATE_MEMBERS = 1n << 40n

export interface ComputePermissionsArgs {
	user: DiscordUser
	context: DiscordGuild
	overwrites?: DiscordPermissionOverwrites
}

export interface PermissionsModule {
	computePermissions: (args: ComputePermissionsArgs) => bigint | number
	canEveryoneRole?: unknown
}

let permissionsModule: PermissionsModule | undefined

interface CacheEntry<T> {
	value: T
	expiresAt: number
}

const tagCache = new Map<string, CacheEntry<TagResult | undefined>>()
const roleColorCache = new Map<string, CacheEntry<string | undefined>>()

let lastCustomTagsRef: CustomTagsConfig | undefined
let customTagsKey = ''

function getCustomTagsKey(customTags?: CustomTagsConfig): string {
	if (!customTags) return ''
	if (customTags === lastCustomTagsRef) return customTagsKey
	lastCustomTagsRef = customTags
	customTagsKey = JSON.stringify(customTags)
	return customTagsKey
}

function pruneCache<T>(cache: Map<string, CacheEntry<T>>): void {
	const now = Date.now()
	for (const [k, v] of cache) {
		if (v.expiresAt <= now || cache.size > 300) {
			cache.delete(k)
		}
	}
}

export function clearTagCache(): void {
	tagCache.clear()
	roleColorCache.clear()
	lastCustomTagsRef = undefined
	customTagsKey = ''
}

export function initPermissionsModule(): () => void {
	return getModules(
		withProps<PermissionsModule>('computePermissions', 'canEveryoneRole'),
		mod => {
			permissionsModule = mod
		},
	)
}

export function computeUserPermissions(
	user: DiscordUser,
	guild: DiscordGuild,
	overwrites?: DiscordPermissionOverwrites,
): bigint {
	if (!permissionsModule) {
		const [found] = lookupModule(
			withProps<PermissionsModule>('computePermissions', 'canEveryoneRole'),
		)
		if (found) {
			permissionsModule = found
		}
	}

	if (permissionsModule?.computePermissions) {
		try {
			const raw = permissionsModule.computePermissions({
				user,
				context: guild,
				overwrites,
			})
			return BigInt(raw)
		} catch {
			return 0n
		}
	}

	return 0n
}

import {
	BRAND_COLOR,
	extractBaseColor,
	formatChatTagText,
	getPerceivedLuminance,
	isDiscordIconName,
	resolveTagStyle,
	TAG_KEYS,
	TEXT_DARK,
	TEXT_LIGHT,
} from './tagLogic'

export {
	BRAND_COLOR,
	extractBaseColor,
	formatChatTagText,
	getPerceivedLuminance,
	isDiscordIconName,
	resolveTagStyle,
	TAG_KEYS,
	TEXT_DARK,
	TEXT_LIGHT,
}

export const tags: Tag[] = [
	{
		text: 'WEBHOOK',
		condition: (_guild, _channel, user) => Boolean(user?.isNonUserBot?.()),
	},
	{
		text: 'OWNER',
		condition: (guild, _channel, user) =>
			Boolean(guild?.ownerId && user?.id && guild.ownerId === user.id),
	},
	{
		text: 'ADMIN',
		permissions: [ADMINISTRATOR],
	},
	{
		text: 'STAFF',
		permissions: [MANAGE_GUILD, MANAGE_CHANNELS, MANAGE_ROLES, MANAGE_WEBHOOKS],
	},
	{
		text: 'MOD',
		permissions: [MANAGE_MESSAGES, KICK_MEMBERS, BAN_MEMBERS],
	},
	{
		text: 'VC Mod',
		permissions: [MOVE_MEMBERS, MUTE_MEMBERS, DEAFEN_MEMBERS],
	},
	{
		text: 'Chat Mod',
		permissions: [MODERATE_MEMBERS],
	},
]

export function extractMemberRoleColor(
	guildId: string | undefined,
	userId: string | undefined,
): string | undefined {
	if (!guildId || !userId) return undefined

	const key = `${guildId}:${userId}`
	const now = Date.now()
	const cached = roleColorCache.get(key)
	if (cached && cached.expiresAt > now) {
		return cached.value
	}

	const GuildMemberStore = Stores.GuildMemberStore as
		| DiscordModules.Flux.Store<{
				getMember(
					guildId?: string,
					userId?: string,
				): DiscordGuildMember | undefined
		  }>
		| undefined

	const member = GuildMemberStore?.getMember(guildId, userId)
	if (!member) {
		if (roleColorCache.size > 500) pruneCache(roleColorCache)
		roleColorCache.set(key, { value: undefined, expiresAt: now + 5000 })
		return undefined
	}

	let result: string | undefined
	const colorStrings = member.colorStrings
	if (colorStrings?.primaryColor && colorStrings?.secondaryColor) {
		if (colorStrings.tertiaryColor) {
			result = `linear-gradient(90deg, ${colorStrings.primaryColor}, ${colorStrings.secondaryColor}, ${colorStrings.tertiaryColor})`
		} else {
			result = `linear-gradient(90deg, ${colorStrings.primaryColor}, ${colorStrings.secondaryColor})`
		}
	} else if (member.colorRoleId) {
		const GuildRoleStore = Stores.GuildRoleStore as
			| DiscordModules.Flux.Store<{
					getRole(
						guildId?: string,
						roleId?: string,
					):
						| {
								colorStrings?: DiscordRoleColorStrings | null
								colorString?: string | null
						  }
						| undefined
			  }>
			| undefined
		const role = GuildRoleStore?.getRole(guildId, member.colorRoleId)
		if (role?.colorStrings?.primaryColor && role.colorStrings.secondaryColor) {
			if (role.colorStrings.tertiaryColor) {
				result = `linear-gradient(90deg, ${role.colorStrings.primaryColor}, ${role.colorStrings.secondaryColor}, ${role.colorStrings.tertiaryColor})`
			} else {
				result = `linear-gradient(90deg, ${role.colorStrings.primaryColor}, ${role.colorStrings.secondaryColor})`
			}
		} else if (role?.colorString) {
			result = role.colorString
		}
	}

	if (!result && member.colorString) {
		result = member.colorString
	}

	if (roleColorCache.size > 500) pruneCache(roleColorCache)
	roleColorCache.set(key, { value: result, expiresAt: now + 5000 })
	return result
}

export function getTag(
	guild?: DiscordGuild,
	channel?: DiscordChannel,
	user?: DiscordUser,
	useRoleColor = false,
	customTags?: CustomTagsConfig,
): TagResult | undefined {
	if (!user) return undefined

	const now = Date.now()
	const key = `${user.id}:${guild?.id ?? ''}:${channel?.id ?? ''}:${useRoleColor ? 1 : 0}:${getCustomTagsKey(customTags)}`
	const cached = tagCache.get(key)
	if (cached && cached.expiresAt > now) {
		return cached.value
	}

	let userPermissions = 0n
	if (guild) {
		userPermissions = computeUserPermissions(
			user,
			guild,
			channel?.permissionOverwrites,
		)
	}

	let result: TagResult | undefined
	for (const tag of tags) {
		const matchesCondition = tag.condition?.(guild, channel, user)
		const matchesPermissions =
			!user.bot &&
			tag.permissions !== undefined &&
			tag.permissions.some(perm => (userPermissions & perm) !== 0n)

		if (matchesCondition || matchesPermissions) {
			const customConfig = customTags?.[tag.text]
			let roleColor: string | undefined

			if (useRoleColor && guild?.id && user.id) {
				roleColor = extractMemberRoleColor(guild.id, user.id)
			}

			const style = resolveTagStyle(tag, roleColor, useRoleColor, customConfig)

			const verified =
				typeof tag.verified === 'function'
					? tag.verified(guild, channel, user)
					: (tag.verified ?? false)

			result = {
				...style,
				verified,
			}
			break
		}
	}

	if (tagCache.size > 500) pruneCache(tagCache)
	tagCache.set(key, { value: result, expiresAt: now + 5000 })
	return result
}
