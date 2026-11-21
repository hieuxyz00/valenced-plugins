import { Stores } from '@valenced/discord/flux'
import { ChannelTypes, Permissions } from '../constants'
import type { ChannelRecord, PermissionStoreExports } from '../types'

export function isVoiceChannel(
	channel: ChannelRecord | null | undefined,
): boolean {
	if (!channel) return false
	if (
		channel.type === ChannelTypes.GUILD_VOICE ||
		channel.type === ChannelTypes.GUILD_STAGE_VOICE ||
		channel.type === 2 ||
		channel.type === 13 ||
		String(channel.type).includes('VOICE') ||
		String(channel.type).includes('STAGE')
	) {
		return true
	}
	if (typeof channel.isGuildVoice === 'function' && channel.isGuildVoice()) {
		return true
	}
	if (
		typeof channel.isGuildStageVoice === 'function' &&
		channel.isGuildStageVoice()
	) {
		return true
	}
	const candidate = channel as unknown as { isVoice?: () => boolean }
	if (typeof candidate.isVoice === 'function' && candidate.isVoice()) {
		return true
	}
	return false
}

export function hasPermission(
	channel: ChannelRecord | null | undefined,
	permission: bigint,
): boolean {
	if (!channel?.id) return false
	try {
		const guildId = channel.guild_id ?? channel.guildId
		if (guildId) {
			const guildStore = Stores.GuildStore as unknown as
				| { getGuild?(id: string): { ownerId?: string } | undefined }
				| undefined
			const userStore = Stores.UserStore as unknown as
				| { getCurrentUser?(): { id?: string } | undefined }
				| undefined
			const ownerId = guildStore?.getGuild?.(guildId)?.ownerId
			const currentUserId = userStore?.getCurrentUser?.()?.id
			if (ownerId && currentUserId && ownerId === currentUserId) {
				return true
			}
		}

		const store = (Stores.PermissionStore ??
			(Stores as unknown as Record<string, unknown>)
				.PermissionsStore) as unknown as PermissionStoreExports | undefined
		if (!store || typeof store.can !== 'function') {
			return true
		}
		const hasSpecific = Boolean(store.can(permission, channel))
		if (hasSpecific) return true
		if (store.can(Permissions.ADMINISTRATOR, channel)) return true
		if (store.can(1n << 4n, channel)) return true
		return false
	} catch {
		return true
	}
}

export function canSetVoiceStatus(
	channel: ChannelRecord | null | undefined,
): boolean {
	return hasPermission(channel, Permissions.SET_VOICE_CHANNEL_STATUS)
}

export function canMoveMembers(
	channel: ChannelRecord | null | undefined,
): boolean {
	return hasPermission(channel, Permissions.MOVE_MEMBERS)
}

export function canMuteMembers(
	channel: ChannelRecord | null | undefined,
): boolean {
	return hasPermission(channel, Permissions.MUTE_MEMBERS)
}

export function canDeafenMembers(
	channel: ChannelRecord | null | undefined,
): boolean {
	return hasPermission(channel, Permissions.DEAFEN_MEMBERS)
}
