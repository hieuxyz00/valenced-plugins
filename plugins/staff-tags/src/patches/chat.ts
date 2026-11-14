import { getAssetIdByName } from '@valenced/assets'
import { Stores } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { after, instead } from '@valenced/patcher'
import { Image, processColor } from 'react-native'
import { extractBaseColor, formatChatTagText, getTag } from '../lib/tags'
import { clearNativeTags, putNativeTags } from '../native'
import type { DiscordModules } from '@valenced/discord/types'
import type { JsonStorage } from '@valenced/json-storage'
import type {
	DiscordChannel,
	DiscordGuild,
	DiscordMessage,
	DiscordUser,
	Settings,
	TagPropertiesResult,
} from '../types'

export function parseGradientColors(
	colorStr: string | undefined,
): number[] | undefined {
	if (!colorStr?.includes('gradient')) return undefined
	const matches = colorStr.match(
		/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g,
	)
	if (!matches || matches.length < 2) return undefined
	const colors: number[] = []
	for (const m of matches) {
		const pc = processColor(m)
		if (typeof pc === 'number') {
			colors.push(pc)
		}
	}
	return colors.length >= 2 ? colors : undefined
}

export function parseGradientOrientation(colorStr?: string): string {
	if (!colorStr?.includes('gradient')) return 'LEFT_RIGHT'
	const angleMatch = colorStr.match(/([+-]?\d+(?:\.\d+)?)\s*deg/i)
	if (angleMatch) {
		const rawDeg = Math.round(Number.parseFloat(angleMatch[1]))
		const deg = ((rawDeg % 360) + 360) % 360
		if (deg >= 23 && deg < 68) return 'BL_TR'
		if (deg >= 68 && deg < 113) return 'LEFT_RIGHT'
		if (deg >= 113 && deg < 158) return 'TL_BR'
		if (deg >= 158 && deg < 203) return 'TOP_BOTTOM'
		if (deg >= 203 && deg < 248) return 'TR_BL'
		if (deg >= 248 && deg < 293) return 'RIGHT_LEFT'
		if (deg >= 293 && deg < 338) return 'BR_TL'
		return 'BOTTOM_TOP'
	}
	if (
		colorStr.includes('to bottom right') ||
		colorStr.includes('to right bottom')
	)
		return 'TL_BR'
	if (
		colorStr.includes('to bottom left') ||
		colorStr.includes('to left bottom')
	)
		return 'TR_BL'
	if (colorStr.includes('to top right') || colorStr.includes('to right top'))
		return 'BL_TR'
	if (colorStr.includes('to top left') || colorStr.includes('to left top'))
		return 'BR_TL'
	if (colorStr.includes('to bottom')) return 'TOP_BOTTOM'
	if (colorStr.includes('to top')) return 'BOTTOM_TOP'
	if (colorStr.includes('to left')) return 'RIGHT_LEFT'
	return 'LEFT_RIGHT'
}

export function patchChat(jsonStorage: JsonStorage<Settings>): () => void {
	const unsubs: Array<() => void> = []

	const unsubModules = getModules(
		withName('getTagProperties'),
		mod => {
			const moduleRecord = mod as Record<string, unknown>
			const targetKey =
				'default' in moduleRecord && typeof moduleRecord.default === 'function'
					? 'default'
					: 'getTagProperties' in moduleRecord &&
							typeof moduleRecord.getTagProperties === 'function'
						? 'getTagProperties'
						: undefined

			if (!targetKey) return

			const targetObj = moduleRecord as Record<
				string,
				(...args: unknown[]) => unknown
			>

			const unpatchInstead = instead(
				targetObj,
				targetKey,
				function (args, orig) {
					const rawRet = Reflect.apply(orig, this, args) as
						| TagPropertiesResult
						| undefined

					// If Discord already assigned an official system / bot tag type (tagType != null), do not overwrite it
					if (
						rawRet &&
						rawRet.tagType !== undefined &&
						rawRet.tagType !== null
					) {
						return rawRet
					}

					const arg0 = args[0] as
						| (DiscordMessage & {
								message?: DiscordMessage
								channel?: DiscordChannel
								guild?: DiscordGuild
						  })
						| undefined
					const arg1 = args[1] as Record<string, unknown> | undefined

					// Robust message resolution:
					// Supports: [{ message }], [message], [{ authorId, channelId }]
					const message =
						arg0?.message ??
						(arg0?.id && (arg0?.author || arg0?.authorId || arg0?.author_id)
							? arg0
							: undefined)

					if (!message) {
						return rawRet
					}

					const ChannelStore = Stores.ChannelStore as
						| DiscordModules.Flux.Store<{
								getChannel(id?: string): DiscordChannel | undefined
						  }>
						| undefined
					const GuildStore = Stores.GuildStore as
						| DiscordModules.Flux.Store<{
								getGuild(id?: string): DiscordGuild | undefined
						  }>
						| undefined
					const UserStore = Stores.UserStore as
						| DiscordModules.Flux.Store<{
								getUser(id?: string): DiscordUser | undefined
						  }>
						| undefined
					const SelectedChannelStore = Stores.SelectedChannelStore as
						| DiscordModules.Flux.Store<{
								getChannelId(): string | undefined
						  }>
						| undefined

					// Robust author resolution: message.author, or UserStore via authorId
					const authorId =
						message.author?.id ??
						message.authorId ??
						message.author_id ??
						(arg0?.authorId as string | undefined) ??
						(arg0?.author_id as string | undefined)

					const author =
						message.author ??
						(authorId ? UserStore?.getUser(authorId) : undefined)

					if (!author) {
						return rawRet
					}

					// Robust channel resolution:
					const channelId =
						message.channel_id ??
						message.channelId ??
						(arg0?.channelId as string | undefined) ??
						(arg0?.channel_id as string | undefined) ??
						(arg1?.id as string | undefined) ??
						SelectedChannelStore?.getChannelId()

					const channel =
						arg0?.channel ??
						(arg1 as DiscordChannel | undefined) ??
						(channelId ? ChannelStore?.getChannel(channelId) : undefined)

					// Robust guild resolution:
					const guildId =
						channel?.guild_id ??
						channel?.guildId ??
						message.guild_id ??
						message.guildId ??
						(arg0?.guildId as string | undefined) ??
						(arg0?.guild_id as string | undefined)

					const guild =
						arg0?.guild ?? (guildId ? GuildStore?.getGuild(guildId) : undefined)

					const useRoleColor = jsonStorage.cache?.useRoleColor ?? false
					const customTags = jsonStorage.cache?.customTags
					const tag = getTag(guild, channel, author, useRoleColor, customTags)

					if (tag) {
						const textColorProcessed = tag.textColor
							? processColor(tag.textColor)
							: undefined
						const baseBgColor = extractBaseColor(tag.backgroundColor)
						const backgroundColorProcessed = baseBgColor
							? processColor(baseBgColor)
							: undefined
						const gradColors = parseGradientColors(tag.backgroundColor)

						if (message.id) {
							const assetId = tag.icon ? getAssetIdByName(tag.icon) : undefined
							const assetSource =
								assetId !== undefined &&
								typeof Image.resolveAssetSource === 'function'
									? Image.resolveAssetSource(assetId)
									: undefined
							const assetUri =
								typeof assetSource?.uri === 'string'
									? assetSource.uri
									: undefined

							putNativeTags({
								[message.id]: {
									text: tag.text,
									icon: tag.icon,
									assetUri,
									textColor:
										typeof textColorProcessed === 'number'
											? textColorProcessed
											: undefined,
									backgroundColor:
										typeof backgroundColorProcessed === 'number'
											? backgroundColorProcessed
											: undefined,
									gradient: gradColors,
									gradientOrientation: parseGradientOrientation(
										tag.backgroundColor,
									),
								},
							})
						}

						const ret = (
							rawRet && typeof rawRet === 'object' ? rawRet : {}
						) as TagPropertiesResult

						return {
							...ret,
							tagText: formatChatTagText(tag.text, tag.icon),
							tagTextColor:
								typeof textColorProcessed === 'number'
									? textColorProcessed
									: undefined,
							tagBackgroundColor:
								typeof backgroundColorProcessed === 'number'
									? backgroundColorProcessed
									: undefined,
							tagVerified: tag.verified,
							tagType: undefined,
						}
					}

					return rawRet
				},
			)

			unsubs.push(unpatchInstead)
		},
		{ returnNamespace: true },
	)

	const unsubRowManager = getModules(withName('RowManager'), mod => {
		const candidate = mod as
			| { prototype?: { generate?: (...args: unknown[]) => unknown } }
			| {
					default?: {
						prototype?: { generate?: (...args: unknown[]) => unknown }
					}
			  }
			| {
					RowManager?: {
						prototype?: { generate?: (...args: unknown[]) => unknown }
					}
			  }
			| undefined
		const proto =
			candidate && 'prototype' in candidate && candidate.prototype
				? candidate.prototype
				: candidate && 'default' in candidate && candidate.default?.prototype
					? candidate.default.prototype
					: candidate &&
							'RowManager' in candidate &&
							candidate.RowManager?.prototype
						? candidate.RowManager.prototype
						: undefined

		if (!proto || typeof proto.generate !== 'function') return
		const targetObj = proto as Record<
			'generate',
			(...args: unknown[]) => unknown
		>

		const unpatchAfter = after(targetObj, 'generate', (row: unknown) => {
			const rowObj = row as
				| {
						type?: number
						message?: {
							id?: string
							channelId?: string
							channel_id?: string
							guildId?: string
							guild_id?: string
							authorId?: string
							author_id?: string
							author?: DiscordUser
							tagText?: string
							tagTextColor?: number
							tagBackgroundColor?: number
							tagVerified?: boolean
							tagType?: number
						}
				  }
				| undefined

			if (rowObj?.type !== 1 || !rowObj.message) return row

			try {
				const message = rowObj.message

				const ChannelStore = Stores.ChannelStore as
					| DiscordModules.Flux.Store<{
							getChannel(id?: string): DiscordChannel | undefined
					  }>
					| undefined
				const GuildStore = Stores.GuildStore as
					| DiscordModules.Flux.Store<{
							getGuild(id?: string): DiscordGuild | undefined
					  }>
					| undefined
				const UserStore = Stores.UserStore as
					| DiscordModules.Flux.Store<{
							getUser(id?: string): DiscordUser | undefined
					  }>
					| undefined
				const SelectedChannelStore = Stores.SelectedChannelStore as
					| DiscordModules.Flux.Store<{
							getChannelId(): string | undefined
					  }>
					| undefined

				const authorId =
					message.author?.id ?? message.authorId ?? message.author_id

				const author =
					message.author ??
					(authorId ? UserStore?.getUser(authorId) : undefined)

				if (!author) return row

				const channelId =
					message.channel_id ??
					message.channelId ??
					SelectedChannelStore?.getChannelId()
				const channel = ChannelStore?.getChannel(channelId)

				const guildId =
					channel?.guild_id ??
					channel?.guildId ??
					message.guild_id ??
					message.guildId
				const guild = GuildStore?.getGuild(guildId)

				const useRoleColor = jsonStorage.cache?.useRoleColor ?? false
				const customTags = jsonStorage.cache?.customTags
				const tag = getTag(guild, channel, author, useRoleColor, customTags)

				if (tag) {
					let tcNum: number | undefined
					if (tag.textColor) {
						const tc = processColor(tag.textColor)
						if (typeof tc === 'number') {
							message.tagTextColor = tc
							tcNum = tc
						}
					}
					let bgcNum: number | undefined
					const baseBg = extractBaseColor(tag.backgroundColor)
					if (baseBg) {
						const bgc = processColor(baseBg)
						if (typeof bgc === 'number') {
							message.tagBackgroundColor = bgc
							bgcNum = bgc
						}
					}
					const gradColors = parseGradientColors(tag.backgroundColor)

					message.tagVerified = tag.verified
					message.tagType = undefined
					message.tagText = formatChatTagText(tag.text, tag.icon)

					if (message.id) {
						const assetId = tag.icon ? getAssetIdByName(tag.icon) : undefined
						const assetSource =
							assetId !== undefined &&
							typeof Image.resolveAssetSource === 'function'
								? Image.resolveAssetSource(assetId)
								: undefined
						const assetUri =
							typeof assetSource?.uri === 'string' ? assetSource.uri : undefined

						putNativeTags({
							[message.id]: {
								text: tag.text,
								icon: tag.icon,
								assetUri,
								textColor: tcNum,
								backgroundColor: bgcNum,
								gradient: gradColors,
								gradientOrientation: parseGradientOrientation(
									tag.backgroundColor,
								),
							},
						})
					}
				}
			} catch {}

			return row
		})

		unsubs.push(unpatchAfter)
	})

	unsubs.push(unsubModules, unsubRowManager)

	return () => {
		for (const unpatch of unsubs) {
			unpatch()
		}
		clearNativeTags()
	}
}
