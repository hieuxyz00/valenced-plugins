import { Stores } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { findInTree } from '@valenced/utils/tree'
import { createElement } from 'react'
import { getTagModule } from '../lib/tagComponent'
import { getTag } from '../lib/tags'
import { isReactElement } from '../types'
import type { DiscordModules } from '@valenced/discord/types'
import type { JsonStorage } from '@valenced/json-storage'
import type { SearchTree } from '@valenced/utils/tree'
import type {
	DiscordChannel,
	DiscordGuild,
	DiscordMessage,
	DiscordUser,
	ReactElementWithProps,
	Settings,
} from '../types'

interface HeaderNameProps {
	channelId?: string
	guildId?: string
	message?: DiscordMessage
	author?: DiscordUser
	user?: DiscordUser
	[key: string]: unknown
}

interface DisplayNameProps {
	guildId?: string
	channelId?: string
	user?: DiscordUser
	author?: DiscordUser
	authorId?: string
	message?: DiscordMessage
	[key: string]: unknown
}

interface TagReactElement extends ReactElementWithProps {
	props: {
		type?: number
		text?: string
		textColor?: string
		backgroundColor?: string
		verified?: boolean
		icon?: string
		[key: string]: unknown
	}
}

function isTagComponent(node: SearchTree): node is TagReactElement {
	if (!isReactElement(node)) return false
	const typeObj = node.type
	if (typeof typeObj === 'object' && typeObj !== null && 'Types' in typeObj) {
		return true
	}
	if (typeof node.props === 'object' && node.props !== null) {
		return (
			'getBotLabel' in node.props ||
			('text' in node.props && 'type' in node.props)
		)
	}
	return false
}

interface RowReactElement extends ReactElementWithProps {
	props: {
		children: unknown[]
		style?: unknown
		[key: string]: unknown
	}
}

function isRowElement(node: SearchTree): node is RowReactElement {
	if (!isReactElement(node) || !Array.isArray(node.props?.children))
		return false
	const style = node.props.style
	if (!style) return false
	if (Array.isArray(style)) {
		return style.some(
			s =>
				typeof s === 'object' &&
				s !== null &&
				'flexDirection' in s &&
				(s as { flexDirection?: string }).flexDirection === 'row',
		)
	}
	if (typeof style === 'object' && style !== null) {
		return (
			'flexDirection' in style &&
			(style as { flexDirection?: string }).flexDirection === 'row'
		)
	}
	return false
}

export function patchName(jsonStorage: JsonStorage<Settings>): () => void {
	const unsubs: Array<() => void> = []

	const unsubHeader = getModules(
		withName('HeaderName'),
		mod => {
			const moduleRecord = mod as Record<string, unknown>
			const targetKey =
				'default' in moduleRecord && typeof moduleRecord.default === 'function'
					? 'default'
					: 'HeaderName' in moduleRecord &&
							typeof moduleRecord.HeaderName === 'function'
						? 'HeaderName'
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
					const rawRet = Reflect.apply(orig, this, args)
					const props = args[0] as HeaderNameProps | undefined
					if (!props || !rawRet || !isReactElement(rawRet)) return rawRet

					const SelectedChannelStore = Stores.SelectedChannelStore as
						| DiscordModules.Flux.Store<{
								getChannelId(): string | undefined
						  }>
						| undefined

					const channelId =
						props.channelId ??
						props.message?.channel_id ??
						props.message?.channelId ??
						SelectedChannelStore?.getChannelId()

					const ChannelStore = Stores.ChannelStore as
						| DiscordModules.Flux.Store<{
								getChannel(id?: string): DiscordChannel | undefined
						  }>
						| undefined
					const channel = ChannelStore?.getChannel(channelId)

					const guildId =
						props.guildId ??
						props.message?.guild_id ??
						props.message?.guildId ??
						channel?.guild_id ??
						channel?.guildId

					const user = props.user ?? props.author ?? props.message?.author

					if (rawRet.props) {
						if (channelId && !rawRet.props.channelId) {
							rawRet.props.channelId = channelId
						}
						if (guildId && !rawRet.props.guildId) {
							rawRet.props.guildId = guildId
						}
						if (user && !rawRet.props.user) {
							rawRet.props.user = user
						}
						if (props.message && !rawRet.props.message) {
							rawRet.props.message = props.message
						}
					}

					// Deeply set props on child DisplayName element inside HeaderName tree
					findInTree(rawRet as SearchTree, node => {
						if (
							isReactElement(node) &&
							node.props &&
							('user' in node.props ||
								'author' in node.props ||
								'channelId' in node.props)
						) {
							if (channelId && !node.props.channelId) {
								node.props.channelId = channelId
							}
							if (guildId && !node.props.guildId) {
								node.props.guildId = guildId
							}
							if (user && !node.props.user) {
								node.props.user = user
							}
							if (props.message && !node.props.message) {
								node.props.message = props.message
							}
						}
						return false
					})

					return rawRet
				},
			)

			unsubs.push(unpatchInstead)
		},
		{ returnNamespace: true },
	)

	const unsubDisplay = getModules(
		withName('DisplayName'),
		mod => {
			const moduleRecord = mod as Record<string, unknown>
			const targetKey =
				'default' in moduleRecord && typeof moduleRecord.default === 'function'
					? 'default'
					: 'DisplayName' in moduleRecord &&
							typeof moduleRecord.DisplayName === 'function'
						? 'DisplayName'
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
					const rawRet = Reflect.apply(orig, this, args)
					const props = args[0] as DisplayNameProps | undefined
					if (!rawRet || !props || !isReactElement(rawRet)) {
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

					const channelId =
						props.channelId ??
						props.message?.channel_id ??
						props.message?.channelId ??
						SelectedChannelStore?.getChannelId()

					const channel = ChannelStore?.getChannel(channelId)
					const guildId =
						props.guildId ??
						props.message?.guild_id ??
						props.message?.guildId ??
						channel?.guild_id ??
						channel?.guildId
					const guild = GuildStore?.getGuild(guildId)

					const authorId =
						props.user?.id ??
						props.author?.id ??
						props.authorId ??
						props.message?.author?.id ??
						props.message?.authorId ??
						props.message?.author_id

					const user =
						props.user ??
						props.author ??
						props.message?.author ??
						(authorId ? UserStore?.getUser(authorId) : undefined)

					if (!user) {
						return rawRet
					}

					const tagComponent = findInTree(rawRet as SearchTree, isTagComponent)

					if (!tagComponent || tagComponent.props.type === 0) {
						const useRoleColor = jsonStorage.cache?.useRoleColor ?? false
						const customTags = jsonStorage.cache?.customTags
						const tag = getTag(guild, channel, user, useRoleColor, customTags)

						if (tag) {
							if (tagComponent) {
								tagComponent.props.type = 0
								tagComponent.props.text = tag.text
								tagComponent.props.textColor = tag.textColor
								tagComponent.props.backgroundColor = tag.backgroundColor
								tagComponent.props.verified = tag.verified
								tagComponent.props.icon = tag.icon
							} else {
								const row = findInTree(rawRet as SearchTree, isRowElement)
								const container =
									row ??
									(Array.isArray(rawRet.props?.children)
										? (rawRet as RowReactElement)
										: undefined)

								if (
									container?.props &&
									Array.isArray(container.props.children)
								) {
									const hasTag = container.props.children.some(
										child =>
											isReactElement(child) &&
											(child.key === 'staff-tag' || isTagComponent(child)),
									)

									if (!hasTag) {
										const TagComponent = getTagModule()?.default
										if (TagComponent) {
											container.props.children.push(
												createElement(TagComponent, {
													key: 'staff-tag',
													style: { marginLeft: 4 },
													type: 0,
													text: tag.text,
													textColor: tag.textColor,
													backgroundColor: tag.backgroundColor,
													verified: tag.verified,
													icon: tag.icon,
												}),
											)
										}
									}
								}
							}
						}
					}

					return rawRet
				},
			)

			unsubs.push(unpatchInstead)
		},
		{ returnNamespace: true },
	)

	unsubs.push(unsubHeader, unsubDisplay)

	return () => {
		for (const unpatch of unsubs) {
			unpatch()
		}
	}
}
