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

// Permission bit constants
export const KICK_MEMBERS = 1n << 1n // 2n
export const BAN_MEMBERS = 1n << 2n // 4n
export const ADMINISTRATOR = 1n << 3n // 8n
export const MANAGE_CHANNELS = 1n << 4n // 16n
export const MANAGE_GUILD = 1n << 5n // 32n
export const MANAGE_MESSAGES = 1n << 13n // 8192n
export const MUTE_MEMBERS = 1n << 22n // 4194304n
export const DEAFEN_MEMBERS = 1n << 23n // 8388608n
export const MOVE_MEMBERS = 1n << 24n // 16777216n
export const MANAGE_ROLES = 1n << 28n // 268435456n
export const MANAGE_WEBHOOKS = 1n << 29n // 536870912n
export const MODERATE_MEMBERS = 1n << 40n // 1099511627776n

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

/**
 * Extracts a member's top role color, preserving full Discord gradients (linear-gradient)
 * when enhanced role styles / multi-color roles are present.
 */
export function extractMemberRoleColor(
	guildId: string | undefined,
	userId: string | undefined,
): string | undefined {
	if (!guildId || !userId) return undefined

	const GuildMemberStore = Stores.GuildMemberStore as
		| DiscordModules.Flux.Store<{
				getMember(
					guildId?: string,
					userId?: string,
				): DiscordGuildMember | undefined
		  }>
		| undefined

	const member = GuildMemberStore?.getMember(guildId, userId)
	if (!member) return undefined

	// 1. Check member.colorStrings for gradient role colors
	const colorStrings = member.colorStrings
	if (colorStrings?.primaryColor && colorStrings?.secondaryColor) {
		if (colorStrings.tertiaryColor) {
			return `linear-gradient(90deg, ${colorStrings.primaryColor}, ${colorStrings.secondaryColor}, ${colorStrings.tertiaryColor})`
		}
		return `linear-gradient(90deg, ${colorStrings.primaryColor}, ${colorStrings.secondaryColor})`
	}

	// 2. Check GuildRoleStore by colorRoleId if member.colorStrings was not directly set
	if (member.colorRoleId) {
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
				return `linear-gradient(90deg, ${role.colorStrings.primaryColor}, ${role.colorStrings.secondaryColor}, ${role.colorStrings.tertiaryColor})`
			}
			return `linear-gradient(90deg, ${role.colorStrings.primaryColor}, ${role.colorStrings.secondaryColor})`
		}
		if (role?.colorString) {
			return role.colorString
		}
	}

	// 3. Fallback to solid colorString
	if (member.colorString) {
		return member.colorString
	}

	return undefined
}

export function getTag(
	guild?: DiscordGuild,
	channel?: DiscordChannel,
	user?: DiscordUser,
	useRoleColor = false,
	customTags?: CustomTagsConfig,
): TagResult | undefined {
	if (!user) return undefined

	let userPermissions = 0n
	if (guild) {
		userPermissions = computeUserPermissions(
			user,
			guild,
			channel?.permissionOverwrites,
		)
	}

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

			return {
				...style,
				verified,
			}
		}
	}

	return undefined
}
