import { Stores } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { createFilterGenerator } from '@valenced/modules/finders/filters'
import { after, before } from '@valenced/patcher'
import { findInTree } from '@valenced/utils/tree'
import { createElement } from 'react'
import { getTagModule } from '../lib/tagComponent'
import { getTag } from '../lib/tags'
import { isReactElement } from '../types'
import type { DiscordModules } from '@valenced/discord/types'
import type { JsonStorage } from '@valenced/json-storage'
import type { SearchTree } from '@valenced/utils/tree'
import type {
	DiscordGuild,
	DiscordUser,
	ReactElementWithProps,
	Settings,
} from '../types'

interface UserRowProps {
	guildId?: string
	user?: DiscordUser
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
	return typeof typeObj === 'object' && typeObj !== null && 'Types' in typeObj
}

interface NameContainerElement extends ReactElementWithProps {
	props: {
		children: unknown[]
		[key: string]: unknown
	}
}

function hasTextChild(node: unknown): boolean {
	if (typeof node === 'string') return true
	if (isReactElement(node) && typeof node.props?.children === 'string') {
		return true
	}
	return false
}

function isNameContainer(node: SearchTree): node is NameContainerElement {
	if (!isReactElement(node) || !Array.isArray(node.props?.children)) {
		return false
	}
	return (node.props.children as unknown[]).some(hasTextChild)
}

const withUserRow = createFilterGenerator<[]>(
	(_, _id, exports) => {
		if (!exports) return false
		if (typeof exports === 'object') {
			const exp = exports as Record<string, unknown>
			if (
				typeof exp.type === 'function' &&
				(exp.type as { name?: string }).name === 'UserRow'
			) {
				return true
			}
			if (typeof exp.name === 'string' && exp.name === 'UserRow') {
				return true
			}
			const def = exp.default
			if (typeof def === 'object' && def !== null) {
				const defRecord = def as Record<string, unknown>
				if (
					typeof defRecord.type === 'function' &&
					(defRecord.type as { name?: string }).name === 'UserRow'
				) {
					return true
				}
			}
			if (
				typeof def === 'function' &&
				(def as { name?: string }).name === 'UserRow'
			) {
				return true
			}
		}
		return false
	},
	() => 'hieuxyz.staff-tags.userRow',
)

export function patchDetails(jsonStorage: JsonStorage<Settings>): () => void {
	const unsubs: Array<() => void> = []

	const unsubModules = getModules(
		withUserRow(),
		component => {
			const compRecord = component as Record<string, unknown>
			let targetObj: Record<string, (...args: unknown[]) => unknown> | undefined
			let targetKey: string | undefined

			if (typeof compRecord.type === 'function') {
				targetObj = compRecord as Record<
					string,
					(...args: unknown[]) => unknown
				>
				targetKey = 'type'
			} else if (
				typeof compRecord.default === 'object' &&
				compRecord.default !== null &&
				typeof (compRecord.default as Record<string, unknown>).type ===
					'function'
			) {
				targetObj = compRecord.default as Record<
					string,
					(...args: unknown[]) => unknown
				>
				targetKey = 'type'
			} else if (typeof compRecord.default === 'function') {
				targetObj = compRecord as Record<
					string,
					(...args: unknown[]) => unknown
				>
				targetKey = 'default'
			}

			if (!targetObj || !targetKey) return

			let currentRowProps: UserRowProps | undefined

			const unpatchBefore = before(targetObj, targetKey, args => {
				const props = args[0] as UserRowProps | undefined
				currentRowProps = props
				return args
			})

			const unpatchAfter = after(targetObj, targetKey, rawRes => {
				const props = currentRowProps
				currentRowProps = undefined

				if (!rawRes || !props || !isReactElement(rawRes)) {
					return rawRes
				}

				const label = rawRes.props?.label
				if (typeof label !== 'object' || label === null) {
					return rawRes
				}

				const nameContainer = findInTree(label as SearchTree, isNameContainer)

				if (!nameContainer) {
					return rawRes
				}

				const existingTag = findInTree(
					nameContainer as SearchTree,
					isTagComponent,
				)

				if (existingTag && existingTag.props.type !== 0) {
					return rawRes
				}

				const GuildStore = Stores.GuildStore as
					| DiscordModules.Flux.Store<{
							getGuild(id?: string): DiscordGuild | undefined
					  }>
					| undefined

				const guild = GuildStore?.getGuild(props.guildId)
				const useRoleColor = jsonStorage.cache?.useRoleColor ?? false
				const customTags = jsonStorage.cache?.customTags
				const tag = getTag(
					guild,
					undefined,
					props.user,
					useRoleColor,
					customTags,
				)

				if (tag) {
					if (existingTag) {
						existingTag.props.type = 0
						existingTag.props.text = tag.text
						existingTag.props.textColor = tag.textColor
						existingTag.props.backgroundColor = tag.backgroundColor
						existingTag.props.verified = tag.verified
						existingTag.props.icon = tag.icon
					} else {
						const TagComponent = getTagModule()?.default
						if (TagComponent) {
							nameContainer.props.children.push(
								createElement(TagComponent, {
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

				return rawRes
			})

			unsubs.push(unpatchBefore, unpatchAfter)
		},
		{ returnNamespace: true },
	)

	unsubs.push(unsubModules)

	return () => {
		for (const unpatch of unsubs) {
			unpatch()
		}
	}
}
