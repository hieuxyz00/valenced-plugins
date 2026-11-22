import TableRowAssetIcon from '@valenced/components/TableRowAssetIcon'
import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { getModules, lookupModule } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { before, instead } from '@valenced/patcher'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { cloneElement, createElement, isValidElement } from 'react'
import { Vibration } from 'react-native'
import { isUserPinned, togglePinUser } from '../utils/storage'
import { showToast } from '../utils/toast'
import type { JsonStorage } from '@valenced/json-storage'
import type { ComponentType, ReactElement } from 'react'
import type {
	ActionSheetRowComponentProps,
	MentionQueryItemUser,
	Settings,
} from '../types'

interface SheetRawProps {
	userId?: string
	user_id?: string
	user?: MentionQueryItemUser & { userId?: string }
	member?: { userId?: string; user?: { id?: string } }
	guildId?: string
	guild_id?: string
	guild?: { id?: string }
	channelId?: string
	channel_id?: string
	channel?: { id?: string; guild_id?: string }
	onClose?: () => void
	[key: string]: unknown
}

interface UserStoreType {
	getCurrentUser?: () => { id?: string } | undefined
	getUser?: (id: string) => MentionQueryItemUser | undefined
}

interface GuildStoreType {
	getGuild?: (id: string) => { id?: string; name?: string } | undefined
}

interface SelectedGuildStoreType {
	getGuildId?: () => string | undefined
}

interface ChannelStoreType {
	getChannel?: (id: string) => { guild_id?: string } | undefined
}

type InnerComponent = (props: Record<string, unknown>) => ReactElement | null

type SheetElement = ReactElement<Record<string, unknown>>

interface ContextMenuItem {
	label: string
	action: () => void
	variant?: string
	[key: string]: unknown
}

interface OverflowMenuExports {
	name?: string
	default?: InnerComponent | { type?: InnerComponent }
	[key: string]: unknown
}

const ACTION_ROW_KEY = 'pinned-mentions-member-action-row'
const patchedOverflowTargets = new WeakSet<object>()
let lastOpenedUserId: string | undefined
let lastOpenedGuildId = 'global'

function resolveOverflowModule(
	rawMod: unknown,
): OverflowMenuExports | undefined {
	if (!rawMod || typeof rawMod !== 'object') return undefined
	const r = rawMod as Record<string, unknown>
	if (
		'default' in r &&
		typeof r.default === 'object' &&
		r.default !== null &&
		'default' in (r.default as Record<string, unknown>)
	) {
		return r.default as OverflowMenuExports
	}
	return r as unknown as OverflowMenuExports
}

function extractUserId(
	props: Record<string, unknown> | undefined,
): string | undefined {
	if (!props) return undefined
	const direct = props.userId || props.user_id
	if (typeof direct === 'string') return direct
	const user = props.user as { id?: string; userId?: string } | undefined
	if (typeof user?.id === 'string') return user.id
	if (typeof user?.userId === 'string') return user.userId
	const member = props.member as
		| { userId?: string; user?: { id?: string } }
		| undefined
	if (typeof member?.userId === 'string') return member.userId
	if (typeof member?.user?.id === 'string') return member.user.id
	const profile = props.profile as
		| { userId?: string; user?: { id?: string } }
		| undefined
	if (typeof profile?.userId === 'string') return profile.userId
	if (typeof profile?.user?.id === 'string') return profile.user.id
	const targetUser = props.targetUser as { id?: string } | undefined
	if (typeof targetUser?.id === 'string') return targetUser.id
	return undefined
}

function extractGuildId(props: Record<string, unknown> | undefined): string {
	if (props) {
		const direct = props.guildId || props.guild_id
		if (typeof direct === 'string' && direct !== '@me') return direct
		const guild = props.guild as { id?: string } | undefined
		if (typeof guild?.id === 'string' && guild.id !== '@me') return guild.id
		const channel = props.channel as
			| { id?: string; guild_id?: string }
			| undefined
		if (typeof channel?.guild_id === 'string' && channel.guild_id !== '@me') {
			return channel.guild_id
		}
		const channelId = (props.channelId || props.channel_id) as
			| string
			| undefined
		if (channelId) {
			const chan = (
				Stores?.ChannelStore as ChannelStoreType | undefined
			)?.getChannel?.(channelId)
			if (chan?.guild_id && chan.guild_id !== '@me') return chan.guild_id
		}
	}
	const selGuildId = (
		Stores?.SelectedGuildStore as SelectedGuildStoreType | undefined
	)?.getGuildId?.()
	if (selGuildId && selGuildId !== '@me') return selGuildId
	return 'global'
}

function isActionSheetRow(child: unknown): boolean {
	if (!isValidElement(child)) return false
	const props = child.props as ActionSheetRowComponentProps | undefined
	if (!props) return false
	const hasLabel =
		typeof props.label === 'string' || typeof props.message === 'string'
	const hasPress =
		typeof props.onPress === 'function' ||
		typeof props.onPressRow === 'function'
	return hasLabel && hasPress
}

function hasActionRow(tree: unknown): boolean {
	if (!tree) return false
	if (Array.isArray(tree)) return tree.some(hasActionRow)
	if (isValidElement(tree)) {
		if (tree.key === ACTION_ROW_KEY) return true
		const p = tree.props as { testID?: string; children?: unknown } | undefined
		if (p?.testID === ACTION_ROW_KEY) return true
		return hasActionRow(p?.children)
	}
	return false
}

function findSampleRow(
	tree: unknown,
): ReactElement<ActionSheetRowComponentProps> | undefined {
	if (!tree) return undefined
	if (Array.isArray(tree)) {
		for (const item of tree) {
			const found = findSampleRow(item)
			if (found) return found
		}
		return undefined
	}
	if (isValidElement(tree)) {
		if (isActionSheetRow(tree)) {
			return tree as ReactElement<ActionSheetRowComponentProps>
		}
		const p = tree.props as { children?: unknown } | undefined
		return findSampleRow(p?.children)
	}
	return undefined
}

function injectPinRowIntoChildren(
	children: unknown,
	customRow: ReactElement,
): { newChildren: unknown; injected: boolean } {
	if (!children) return { newChildren: children, injected: false }

	if (Array.isArray(children)) {
		const rowIndex = children.findIndex(isActionSheetRow)
		if (rowIndex !== -1) {
			const insertIdx = rowIndex + 1 < children.length ? rowIndex + 1 : rowIndex
			const copy = [...children]
			copy.splice(insertIdx, 0, customRow)
			return { newChildren: copy, injected: true }
		}

		for (let i = 0; i < children.length; i++) {
			const child = children[i]
			if (isValidElement(child)) {
				const res = injectPinRowIntoElement(child, customRow)
				if (res.injected) {
					const copy = [...children]
					copy[i] = res.newElement
					return { newChildren: copy, injected: true }
				}
			}
		}
		return { newChildren: children, injected: false }
	}

	if (isValidElement(children)) {
		const res = injectPinRowIntoElement(children, customRow)
		return { newChildren: res.newElement, injected: res.injected }
	}

	return { newChildren: children, injected: false }
}

function injectPinRowIntoElement(
	element: ReactElement,
	customRow: ReactElement,
): { newElement: ReactElement; injected: boolean } {
	if (!isValidElement(element)) return { newElement: element, injected: false }
	const props = element.props as
		| { children?: unknown; [key: string]: unknown }
		| undefined
	if (!props?.children) return { newElement: element, injected: false }

	const { newChildren, injected } = injectPinRowIntoChildren(
		props.children,
		customRow,
	)
	if (injected) {
		const sheetElem = element as SheetElement
		return {
			newElement: cloneElement(sheetElem, { ...props, children: newChildren }),
			injected: true,
		}
	}
	return { newElement: element, injected: false }
}

function injectPinRow(
	tree: ReactElement,
	guildId: string,
	userId: string,
	sheetKey: string,
	onCloseCallback: (() => void) | undefined,
	jsonStorage: JsonStorage<Settings>,
): ReactElement {
	if (hasActionRow(tree)) return tree

	const sample = findSampleRow(tree)
	if (!sample) return tree

	const settings = jsonStorage.cache as
		| (Settings & { enableHaptics?: boolean })
		| undefined
	if (settings?.disableInDms && guildId === 'global') return tree
	const isPinned = isUserPinned(settings, guildId, userId)
	const userStore = Stores?.UserStore as UserStoreType | undefined
	const guildStore = Stores?.GuildStore as GuildStoreType | undefined
	const targetUser = userStore?.getUser?.(userId)
	const guild = guildStore?.getGuild?.(guildId)

	const RowIcon =
		(
			sample.type as unknown as {
				Icon?: ComponentType<{ IconComponent?: unknown; source?: number }>
			}
		)?.Icon ??
		(
			Design.ActionSheetRow as unknown as {
				Icon?: ComponentType<{ IconComponent?: unknown; source?: number }>
			}
		)?.Icon

	const iconName = isPinned ? 'PinSlashIcon' : 'PinIcon'
	const iconComponent = lookupGeneratedIconComponent(iconName, 'PinIcon')

	let iconNode: ReactElement = createElement(TableRowAssetIcon, {
		name: iconName,
	})

	if (RowIcon && iconComponent) {
		iconNode = createElement(RowIcon, { IconComponent: iconComponent })
	}

	const customRow = createElement(sample.type, {
		...sample.props,
		key: ACTION_ROW_KEY,
		testID: ACTION_ROW_KEY,
		label: isPinned
			? 'Unpin from Mention Suggestions'
			: 'Pin to Top of Mentions',
		subLabel: guild?.name
			? isPinned
				? 'Currently pinned in this server'
				: `Pin for ${guild.name}`
			: guildId === 'global'
				? isPinned
					? 'Currently pinned globally'
					: 'Pin globally for direct messages'
				: undefined,
		icon: iconNode,
		onPressRow: undefined,
		onPress: () => {
			try {
				if (typeof onCloseCallback === 'function') {
					onCloseCallback()
				}
			} catch {}
			try {
				ActionSheetActionCreators.hideActionSheet(sheetKey)
			} catch {}
			try {
				ActionSheetActionCreators.hideActionSheet()
			} catch {}

			void togglePinUser(
				jsonStorage,
				guildId,
				userId,
				{
					username: targetUser?.username,
					globalName: targetUser?.globalName,
					avatar: targetUser?.avatar,
				},
				guildId,
			).then(newPinned => {
				const shouldVibrate =
					settings?.enableVibration !== undefined
						? settings.enableVibration
						: (settings?.enableHaptics ?? true)
				if (shouldVibrate) {
					try {
						Vibration.vibrate(50)
					} catch {}
				}
				const displayName =
					targetUser?.globalName || targetUser?.username || userId
				const scopeText =
					guildId === 'global' ? 'globally' : 'to top of mentions'
				showToast({
					content: newPinned
						? `Pinned @${displayName} ${scopeText}`
						: `Unpinned @${displayName} from mentions`,
					key: `pin-${userId}-${Date.now()}`,
					variant: newPinned ? 'success' : 'default',
				})
			})
		},
	})

	const res = injectPinRowIntoElement(tree, customRow)
	return res.injected ? res.newElement : tree
}

function injectPinMenuItem(
	element: SheetElement,
	pinItem: ContextMenuItem,
): SheetElement {
	if (!isValidElement(element)) return element
	const props = element.props as
		| { items?: unknown; children?: unknown; [key: string]: unknown }
		| undefined

	if (props?.items && Array.isArray(props.items)) {
		const groups = props.items.map(g => (Array.isArray(g) ? [...g] : g)) as (
			| ContextMenuItem[]
			| ContextMenuItem
		)[]
		const hasExisting = groups.some(g => {
			if (Array.isArray(g)) {
				return g.some(
					i =>
						i?.label?.includes('Mention') || i?.id === 'pinned-mentions-toggle',
				)
			}
			return (
				g &&
				typeof g === 'object' &&
				((g as ContextMenuItem).label?.includes('Mention') ||
					(g as ContextMenuItem).id === 'pinned-mentions-toggle')
			)
		})
		if (!hasExisting && groups.length > 0) {
			if (Array.isArray(groups[0])) {
				groups[0].push(pinItem)
			} else {
				groups.push(pinItem)
			}
			return cloneElement(element, { ...props, items: groups })
		}
		return element
	}

	if (!props?.children) return element

	if (Array.isArray(props.children)) {
		let modified = false
		const nextChildren = props.children.map(child => {
			if (isValidElement(child)) {
				const injected = injectPinMenuItem(child as SheetElement, pinItem)
				if (injected !== child) {
					modified = true
					return injected
				}
			}
			return child
		})
		if (modified) {
			return cloneElement(element, { ...props, children: nextChildren })
		}
	} else if (isValidElement(props.children)) {
		const injected = injectPinMenuItem(props.children as SheetElement, pinItem)
		if (injected !== props.children) {
			return cloneElement(element, { ...props, children: injected })
		}
	}

	return element
}

export function patchMemberActionSheet(
	cleanup: (fn: () => void) => void,
	jsonStorage: JsonStorage<Settings>,
): void {
	const wrappedFunctions = new WeakSet<InnerComponent>()

	const applyPatchToOverflowMod = (rawMod: unknown) => {
		if (!rawMod || typeof rawMod !== 'object') return
		const resolved = resolveOverflowModule(rawMod)
		if (!resolved) return

		let targetObj: Record<string, (...args: unknown[]) => unknown> | undefined
		let key = 'default'

		if (typeof resolved.default === 'function') {
			targetObj = resolved as unknown as Record<
				string,
				(...args: unknown[]) => unknown
			>
			key = 'default'
		} else if (
			typeof resolved.default === 'object' &&
			resolved.default !== null &&
			typeof (resolved.default as { type?: unknown }).type === 'function'
		) {
			targetObj = resolved.default as unknown as Record<
				string,
				(...args: unknown[]) => unknown
			>
			key = 'type'
		}

		if (!targetObj || patchedOverflowTargets.has(targetObj)) return
		patchedOverflowTargets.add(targetObj)

		const unpatch = instead(targetObj, key, function (args, orig) {
			const tree = Reflect.apply(orig, this, args) as SheetElement | null
			if (!tree || !isValidElement(tree)) return tree

			const settings = jsonStorage.cache as Settings | undefined
			if (!settings?.enabled) return tree

			const props = (args[0] as Record<string, unknown> | undefined) || {}
			const targetUser =
				(props.user as MentionQueryItemUser | undefined) ||
				(props.member as { user?: MentionQueryItemUser } | undefined)?.user
			const userId = targetUser?.id || extractUserId(props) || lastOpenedUserId
			if (!userId) return tree

			const userStore = Stores?.UserStore as UserStoreType | undefined
			const currentUserId = userStore?.getCurrentUser?.()?.id
			if (currentUserId && userId === currentUserId) return tree

			const guildId = extractGuildId(props) || lastOpenedGuildId
			if (settings.disableInDms && guildId === 'global') return tree

			const isPinned = isUserPinned(settings, guildId, userId)

			const handlePinAction = () => {
				void togglePinUser(
					jsonStorage,
					guildId,
					userId,
					{
						username: targetUser?.username,
						globalName: targetUser?.globalName,
						avatar: targetUser?.avatar,
					},
					guildId,
				).then(newPinned => {
					const shouldVibrate =
						settings?.enableVibration !== undefined
							? settings.enableVibration
							: true
					if (shouldVibrate) {
						try {
							Vibration.vibrate(50)
						} catch {}
					}
					const displayName =
						targetUser?.globalName || targetUser?.username || userId
					const scopeText =
						guildId === 'global' ? 'globally' : 'to top of mentions'
					showToast({
						content: newPinned
							? `Pinned @${displayName} ${scopeText}`
							: `Unpinned @${displayName} from mentions`,
						key: `pin-${userId}-${Date.now()}`,
						variant: newPinned ? 'success' : 'default',
					})
				})
			}

			const pinMenuItem: ContextMenuItem = {
				id: 'pinned-mentions-toggle',
				key: 'pinned-mentions-toggle',
				label: isPinned
					? 'Unpin from Mention Suggestions'
					: 'Pin to Top of Mentions',
				action: handlePinAction,
				onPress: handlePinAction,
			}

			return injectPinMenuItem(tree, pinMenuItem)
		})

		cleanup(() => {
			if (targetObj) patchedOverflowTargets.delete(targetObj)
			try {
				unpatch()
			} catch {}
		})
	}

	try {
		const [foundMod] = lookupModule(
			withName<OverflowMenuExports>('UserProfileOverflowMenu'),
			{ returnNamespace: true },
		)
		if (foundMod) applyPatchToOverflowMod(foundMod)
	} catch {}

	try {
		const unsub = getModules(
			withName<OverflowMenuExports>('UserProfileOverflowMenu'),
			mod => applyPatchToOverflowMod(mod),
			{ returnNamespace: true },
		)
		cleanup(unsub)
	} catch {}

	try {
		const raw14222 = (
			globalThis as unknown as {
				__r?: (id: number) => unknown
			}
		).__r?.(14222)
		if (raw14222) applyPatchToOverflowMod(raw14222)
	} catch {}

	const wrapInner = (
		Inner: InnerComponent,
		fallbackGuildId: string,
		fallbackUserId: string,
		sheetKey: string,
		onCloseCallback: (() => void) | undefined,
	): InnerComponent => {
		const Wrapper: InnerComponent = (props: Record<string, unknown>) => {
			const rendered = Inner(props)
			if (!rendered || !isValidElement(rendered)) return rendered

			const currentUserId = extractUserId(props) || fallbackUserId
			const currentGuildId = extractGuildId(props) || fallbackGuildId
			const currentOnClose =
				(props.onClose as (() => void) | undefined) || onCloseCallback

			try {
				return injectPinRow(
					rendered,
					currentGuildId,
					currentUserId,
					sheetKey,
					currentOnClose,
					jsonStorage,
				)
			} catch {}
			return rendered
		}

		wrappedFunctions.add(Wrapper)
		return Wrapper
	}

	const unpatch = before(ActionSheetActionCreators, 'openLazy', args => {
		const [sheetPromise, key, rawProps] = args as unknown as [
			Promise<{ default?: unknown }> | undefined,
			string | undefined,
			SheetRawProps | undefined,
		]

		try {
			const [overflowMod] = lookupModule(
				withName<OverflowMenuExports>('UserProfileOverflowMenu'),
				{ returnNamespace: true },
			)
			if (overflowMod) applyPatchToOverflowMod(overflowMod)
		} catch {}

		try {
			const raw14222 = (
				globalThis as unknown as {
					__r?: (id: number) => unknown
				}
			).__r?.(14222)
			if (raw14222) applyPatchToOverflowMod(raw14222)
		} catch {}

		const settings = jsonStorage.cache as Settings | undefined
		if (!settings?.enabled) return args
		if (!sheetPromise?.then || typeof key !== 'string') return args

		const isTargetSheet = /User|Member|Profile/i.test(key)
		if (!isTargetSheet) return args

		const userId = extractUserId(rawProps)
		if (userId) {
			lastOpenedUserId = userId
		}
		const guildId = extractGuildId(rawProps)
		if (guildId) {
			lastOpenedGuildId = guildId
		}
		if (!userId) return args

		const userStore = Stores?.UserStore as UserStoreType | undefined
		const currentUserId = userStore?.getCurrentUser?.()?.id
		if (currentUserId && userId === currentUserId) return args

		const onCloseCallback = rawProps?.onClose

		sheetPromise.then(mod => {
			if (!mod || typeof mod !== 'object') return mod

			let targetObj: Record<string, (...args: unknown[]) => unknown> | undefined
			let patchProp = 'default'

			const modObj = mod as Record<string, unknown>
			if (typeof modObj.default === 'function') {
				targetObj = modObj as Record<string, (...args: unknown[]) => unknown>
				patchProp = 'default'
			} else if (
				typeof modObj.default === 'object' &&
				modObj.default !== null &&
				typeof (modObj.default as { type?: unknown }).type === 'function'
			) {
				targetObj = modObj.default as Record<
					string,
					(...args: unknown[]) => unknown
				>
				patchProp = 'type'
			}

			if (!targetObj || typeof targetObj[patchProp] !== 'function') {
				return mod
			}

			const unpatchSheet = instead(
				targetObj,
				patchProp,
				function (sheetArgs, orig) {
					unpatchSheet()
					const tree = Reflect.apply(
						orig,
						this,
						sheetArgs,
					) as ReactElement | null
					if (!tree || !isValidElement(tree)) return tree

					const currentProps = (sheetArgs[0] || rawProps) as
						| Record<string, unknown>
						| undefined
					const effectiveUserId = extractUserId(currentProps) || userId
					const effectiveGuildId = extractGuildId(currentProps) || guildId
					const effectiveOnClose =
						(currentProps?.onClose as (() => void) | undefined) ||
						onCloseCallback

					const Inner = tree.type as InnerComponent | undefined
					if (
						typeof Inner === 'function' &&
						Inner !== Design.ActionSheet &&
						!wrappedFunctions.has(Inner)
					) {
						const treeProps = (tree.props as Record<string, unknown>) || {}
						return createElement(
							wrapInner(
								Inner,
								effectiveGuildId,
								effectiveUserId,
								key,
								effectiveOnClose,
							),
							{
								...treeProps,
								key: tree.key,
							},
						)
					}

					return injectPinRow(
						tree,
						effectiveGuildId,
						effectiveUserId,
						key,
						effectiveOnClose,
						jsonStorage,
					)
				},
			)

			return mod
		})

		return args
	})

	cleanup(unpatch)
}
