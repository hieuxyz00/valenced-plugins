import type { DiscoverableGuild, GuildPreview } from '../types'

export function formatCount(count: number | undefined): string {
	if (count === undefined || count === null || Number.isNaN(count)) return '0'
	if (count >= 1_000_000) {
		const val = (count / 1_000_000).toFixed(1).replace(/\.0$/, '')
		return `${val}M`
	}
	if (count >= 1_000) {
		const val = (count / 1_000).toFixed(1).replace(/\.0$/, '')
		return `${val}K`
	}
	return String(count)
}

export function getGuildIconUrl(
	guildId: string,
	icon: string | null | undefined,
	size = 128,
): string | null {
	if (!icon || !guildId) return null
	const ext = icon.startsWith('a_') ? 'gif' : 'png'
	return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=${size}`
}

export function getGuildBannerUrl(
	guild: DiscoverableGuild | GuildPreview,
	size = 600,
): string | null {
	if (!guild?.id) return null

	if (guild.discovery_splash) {
		return `https://cdn.discordapp.com/discovery-splashes/${guild.id}/${guild.discovery_splash}.png?size=${size}`
	}

	if (guild.splash) {
		return `https://cdn.discordapp.com/splashes/${guild.id}/${guild.splash}.png?size=${size}`
	}

	if ('home_header' in guild && guild.home_header) {
		return `https://cdn.discordapp.com/discovery-splashes/${guild.id}/${guild.home_header}.png?size=${size}`
	}

	if ('banner' in guild && guild.banner) {
		const ext = guild.banner.startsWith('a_') ? 'gif' : 'png'
		return `https://cdn.discordapp.com/banners/${guild.id}/${guild.banner}.${ext}?size=${size}`
	}

	return null
}

const FEATURE_LABELS: Record<string, string> = {
	VERIFIED: 'Verified',
	PARTNERED: 'Partnered',
	DISCOVERABLE: 'Discoverable',
	COMMUNITY: 'Community',
	FEATURABLE: 'Featured',
	INVITE_SPLASH: 'Custom Invite',
	VIP_REGIONS: 'VIP Voice',
	VANITY_URL: 'Vanity URL',
	BANNER: 'Banner',
	ROLE_ICONS: 'Role Icons',
	SOUNDBOARD: 'Soundboard',
	AUTO_MODERATION: 'AutoMod',
	GUILD_ONBOARDING: 'Onboarding',
	GUILD_TAGS: 'Guild Tags',
}

export function getFeatureLabel(feature: string): string {
	if (FEATURE_LABELS[feature]) return FEATURE_LABELS[feature]
	return feature
		.toLowerCase()
		.split('_')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
}
