import { ToastActionCreators } from '@valenced/discord/actions'
import { Stores } from '@valenced/discord/flux'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { getConstants, writeFile } from '@valenced/modules/native/fs'
import { ReactNative } from '@valenced/react'
import { Platform } from 'react-native'
import { formatMessage, formatMessages } from './formatter'
import type {
	ChannelExportMetadata,
	DiscordMessage,
	ExportDestination,
	Settings,
} from '../types'

export function showToast(
	text: string,
	variant: 'default' | 'success' | 'critical' = 'success',
): void {
	try {
		if (typeof ToastActionCreators?.open === 'function') {
			if (ToastActionCreators.open.length === 1) {
				const singleArg = ToastActionCreators.open as unknown as (opts: {
					key: string
					text: string
					variant?: string
				}) => void
				singleArg({
					key: 'hieuxyz-export-messages',
					text,
					variant,
				})
			} else {
				ToastActionCreators.open('hieuxyz-export-messages', {
					text,
					variant,
				})
			}
		}
	} catch {}
}

export function isSafSupported(): boolean {
	try {
		const hApi = (
			valenced as unknown as {
				hieuxyz?: { saf?: { isSafAvailable?: () => boolean } }
			}
		)?.hieuxyz
		return (
			typeof hApi?.saf?.isSafAvailable === 'function' &&
			hApi.saf.isSafAvailable()
		)
	} catch {
		return false
	}
}

function getMimeType(fileName: string): string {
	if (fileName.endsWith('.html')) return 'text/html'
	if (fileName.endsWith('.json')) return 'application/json'
	return 'text/plain'
}

export async function exportContent(
	content: string,
	destination: ExportDestination,
	fileName: string,
): Promise<void> {
	if (destination === 'clipboard') {
		Clipboard.setString(content)
		showToast('Copied to clipboard!', 'success')
		return
	}

	if (destination === 'saf' && isSafSupported()) {
		try {
			const mimeType = getMimeType(fileName)
			const hApi = (
				valenced as unknown as {
					hieuxyz?: {
						saf?: {
							saveViaSaf?: (
								name: string,
								mime: string,
								data: string,
							) => Promise<boolean>
						}
					}
				}
			)?.hieuxyz
			const ok = await hApi?.saf?.saveViaSaf?.(fileName, mimeType, content)
			if (ok) {
				showToast('Save file dialog opened.', 'success')
				return
			}
		} catch {}
	}

	if (Platform.OS === 'ios') {
		try {
			const constants = getConstants()
			if (constants?.cache) {
				const filePath = `${constants.cache}/${fileName}`
				await writeFile(filePath, content)
				if (ReactNative?.Share?.share) {
					await ReactNative.Share.share({
						url: `file://${filePath}`,
						title: fileName,
					})
					showToast('Shared successfully!', 'success')
					return
				}
			}
		} catch {}
	}

	try {
		if (ReactNative?.Share?.share) {
			await ReactNative.Share.share({
				message: content,
				title: fileName,
			})
			showToast('Shared successfully!', 'success')
		} else {
			Clipboard.setString(content)
			showToast('Share unavailable, copied to clipboard instead.', 'default')
		}
	} catch {
		Clipboard.setString(content)
		showToast('Export failed, copied to clipboard instead.', 'critical')
	}
}

export async function exportSingleMessage(
	message: DiscordMessage,
	settings: Settings,
	destination: ExportDestination,
	customFileName?: string,
): Promise<void> {
	let formatted: string
	if (settings.format === 'html') {
		const targetId = message.channel_id
		const { channelName, guildName, guildIconUrl, topic } =
			getLoadedChannelMessages(targetId)
		const meta: ChannelExportMetadata = {
			id: targetId ?? '0',
			name: channelName,
			guildName,
			guildIconUrl,
			topic,
			totalMessages: 1,
			exportedAt: new Date().toISOString(),
			rangeDescription: `Single Message ID ${message.id}`,
		}
		formatted = formatMessages([message], settings, meta)
	} else {
		formatted = formatMessage(message, settings)
	}
	const ext =
		settings.format === 'html'
			? 'html'
			: settings.format === 'json'
				? 'json'
				: 'txt'
	const fileName = customFileName?.trim() || `discord_msg_${message.id}.${ext}`
	await exportContent(formatted, destination, fileName)
}

interface MessageCollectionInstance {
	toArray?: () => DiscordMessage[]
	_array?: DiscordMessage[]
	length?: number
	hasMoreBefore?: boolean
	hasMoreAfter?: boolean
}

interface MessageStoreInstance {
	getMessages?: (channelId: string) => MessageCollectionInstance | undefined
}

interface ChannelStoreInstance {
	getChannel?: (channelId: string) =>
		| {
				id: string
				name?: string
				guild_id?: string
				topic?: string
				isDM?: () => boolean
		  }
		| undefined
}

interface GuildStoreInstance {
	getGuild?: (guildId: string) =>
		| {
				id: string
				name: string
				icon?: string
		  }
		| undefined
}

interface SelectedChannelStoreInstance {
	getChannelId?: () => string | undefined
}

interface MessageActionsModule {
	fetchMessages?: (opts: {
		channelId: string
		before?: string
		after?: string
		limit?: number
	}) => void
}

export async function ensureMessagesLoaded(
	channelId: string,
	targetCount: number,
	direction: 'before' | 'after' = 'before',
): Promise<DiscordMessage[]> {
	const messageStore = Stores.MessageStore as unknown as
		| MessageStoreInstance
		| undefined

	let msgsObj = messageStore?.getMessages?.(channelId)
	let list = msgsObj?.toArray?.() ?? msgsObj?._array ?? []

	if (list.length >= targetCount) {
		return list
	}

	const [msgActions] = lookupModule(
		withProps('sendMessage', 'fetchMessages'),
	) as [MessageActionsModule | undefined, unknown]

	if (!msgActions?.fetchMessages) {
		return list
	}

	let iterations = 0
	const maxIterations = 20

	showToast(`Loading messages (${list.length}/${targetCount})...`, 'default')

	while (
		list.length < targetCount &&
		((direction === 'before' && msgsObj?.hasMoreBefore) ||
			(direction === 'after' && msgsObj?.hasMoreAfter)) &&
		iterations < maxIterations
	) {
		iterations++
		const needed = Math.min(50, targetCount - list.length)

		if (direction === 'before') {
			const oldestMsg = list[0]
			if (!oldestMsg?.id) break
			msgActions.fetchMessages({
				channelId,
				before: oldestMsg.id,
				limit: needed,
			})
		} else {
			const newestMsg = list[list.length - 1]
			if (!newestMsg?.id) break
			msgActions.fetchMessages({
				channelId,
				after: newestMsg.id,
				limit: needed,
			})
		}

		await new Promise(resolve => setTimeout(resolve, 650))
		msgsObj = messageStore?.getMessages?.(channelId)
		const updated = msgsObj?.toArray?.() ?? msgsObj?._array ?? []

		if (updated.length === list.length) {
			await new Promise(resolve => setTimeout(resolve, 650))
			msgsObj = messageStore?.getMessages?.(channelId)
			const secondTry = msgsObj?.toArray?.() ?? msgsObj?._array ?? []
			if (secondTry.length === list.length) {
				break
			}
			list = secondTry
		} else {
			list = updated
		}
	}

	return list
}

export function getLoadedChannelMessages(channelId?: string): {
	messages: DiscordMessage[]
	channelName: string
	guildName?: string
	guildIconUrl?: string
	topic?: string
} {
	const selStore = Stores.SelectedChannelStore as unknown as
		| SelectedChannelStoreInstance
		| undefined
	const channelStore = Stores.ChannelStore as unknown as
		| ChannelStoreInstance
		| undefined
	const guildStore = Stores.GuildStore as unknown as
		| GuildStoreInstance
		| undefined
	const messageStore = Stores.MessageStore as unknown as
		| MessageStoreInstance
		| undefined

	const targetId = channelId ?? selStore?.getChannelId?.()
	if (!targetId) {
		return { messages: [], channelName: 'Chat' }
	}

	const rawMessages = messageStore?.getMessages?.(targetId)
	const allMsgs = rawMessages?.toArray?.() ?? rawMessages?._array ?? []
	const channel = channelStore?.getChannel?.(targetId)
	const guild = channel?.guild_id
		? guildStore?.getGuild?.(channel.guild_id)
		: undefined

	const guildIconUrl =
		guild?.id && guild?.icon
			? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
			: undefined

	return {
		messages: allMsgs,
		channelName: channel?.name ?? 'Direct Message',
		guildName: guild?.name,
		guildIconUrl,
		topic: channel?.topic,
	}
}

export async function exportChannelHistory(
	channelId: string | undefined,
	limitCount: number | 'all',
	settings: Settings,
	destination: ExportDestination,
	customFileName?: string,
): Promise<void> {
	const selStore = Stores.SelectedChannelStore as unknown as
		| SelectedChannelStoreInstance
		| undefined
	const targetId = channelId ?? selStore?.getChannelId?.()
	if (!targetId) {
		showToast('No active channel found.', 'critical')
		return
	}

	let allMsgs: DiscordMessage[]
	if (typeof limitCount === 'number' && limitCount > 0) {
		allMsgs = await ensureMessagesLoaded(targetId, limitCount)
	} else {
		const { messages } = getLoadedChannelMessages(targetId)
		allMsgs = messages
	}

	if (allMsgs.length === 0) {
		showToast('No loaded messages found in this channel.', 'default')
		return
	}

	let selectedMsgs = allMsgs
	if (
		typeof limitCount === 'number' &&
		limitCount > 0 &&
		limitCount < allMsgs.length
	) {
		selectedMsgs = allMsgs.slice(-limitCount)
	}

	const { channelName, guildName, guildIconUrl, topic } =
		getLoadedChannelMessages(targetId)
	const cleanChannelName = channelName.replace(/[^a-zA-Z0-9_-]/g, '_')
	const ext =
		settings.format === 'html'
			? 'html'
			: settings.format === 'json'
				? 'json'
				: 'txt'
	const defaultFileName = `discord_${cleanChannelName}_${Date.now()}.${ext}`
	const fileName = customFileName?.trim() || defaultFileName

	const meta: ChannelExportMetadata = {
		id: targetId,
		name: channelName,
		guildName,
		guildIconUrl,
		topic,
		totalMessages: selectedMsgs.length,
		exportedAt: new Date().toISOString(),
		rangeDescription:
			typeof limitCount === 'number'
				? `Last ${selectedMsgs.length} message(s)`
				: `All ${selectedMsgs.length} message(s)`,
	}

	const formatted = formatMessages(selectedMsgs, settings, meta)
	await exportContent(formatted, destination, fileName)
}

export async function exportRangedHistory(
	channelId: string | undefined,
	targetMessage: DiscordMessage,
	scope: 'before' | 'after',
	limitCount: number | 'all',
	settings: Settings,
	destination: ExportDestination,
	customFileName?: string,
): Promise<void> {
	const selStore = Stores.SelectedChannelStore as unknown as
		| SelectedChannelStoreInstance
		| undefined
	const targetId =
		channelId ?? targetMessage.channel_id ?? selStore?.getChannelId?.()
	if (!targetId) {
		showToast('No active channel found.', 'critical')
		return
	}

	const { channelName, guildName, guildIconUrl, topic } =
		getLoadedChannelMessages(targetId)
	const messageStore = Stores.MessageStore as unknown as
		| MessageStoreInstance
		| undefined

	let allMsgs: DiscordMessage[]
	let selectedMsgs: DiscordMessage[]

	if (scope === 'before') {
		const rawMessages = messageStore?.getMessages?.(targetId)
		const currentList = rawMessages?.toArray?.() ?? rawMessages?._array ?? []
		const targetIdx = currentList.findIndex(m => m.id === targetMessage.id)

		if (typeof limitCount === 'number' && limitCount > 0) {
			const currentBeforeCount =
				targetIdx !== -1 ? targetIdx + 1 : currentList.length
			if (currentBeforeCount < limitCount && rawMessages?.hasMoreBefore) {
				const needed = limitCount - currentBeforeCount
				allMsgs = await ensureMessagesLoaded(
					targetId,
					currentList.length + needed,
					'before',
				)
			} else {
				allMsgs = currentList
			}
		} else if (limitCount === 'all') {
			allMsgs = await ensureMessagesLoaded(
				targetId,
				Math.max(500, currentList.length + 50),
				'before',
			)
		} else {
			allMsgs = currentList
		}

		const newTargetIdx = allMsgs.findIndex(m => m.id === targetMessage.id)
		const effectiveEnd = newTargetIdx !== -1 ? newTargetIdx + 1 : allMsgs.length
		selectedMsgs =
			typeof limitCount === 'number' &&
			limitCount > 0 &&
			limitCount < effectiveEnd
				? allMsgs.slice(effectiveEnd - limitCount, effectiveEnd)
				: allMsgs.slice(0, effectiveEnd)
	} else {
		const rawMessages = messageStore?.getMessages?.(targetId)
		const currentList = rawMessages?.toArray?.() ?? rawMessages?._array ?? []
		const targetIdx = currentList.findIndex(m => m.id === targetMessage.id)

		if (typeof limitCount === 'number' && limitCount > 0) {
			const currentAfterCount =
				targetIdx !== -1 ? currentList.length - targetIdx : currentList.length
			if (currentAfterCount < limitCount && rawMessages?.hasMoreAfter) {
				const needed = limitCount - currentAfterCount
				allMsgs = await ensureMessagesLoaded(
					targetId,
					currentList.length + needed,
					'after',
				)
			} else {
				allMsgs = currentList
			}
		} else {
			allMsgs = currentList
		}

		const newTargetIdx = allMsgs.findIndex(m => m.id === targetMessage.id)
		const effectiveStart = newTargetIdx !== -1 ? newTargetIdx : 0
		selectedMsgs =
			typeof limitCount === 'number' && limitCount > 0
				? allMsgs.slice(effectiveStart, effectiveStart + limitCount)
				: allMsgs.slice(effectiveStart)
	}

	if (selectedMsgs.length === 0) {
		showToast('No messages matched the export range.', 'default')
		return
	}

	const cleanChannelName = channelName.replace(/[^a-zA-Z0-9_-]/g, '_')
	const ext =
		settings.format === 'html'
			? 'html'
			: settings.format === 'json'
				? 'json'
				: 'txt'
	const defaultFileName = `discord_${cleanChannelName}_${scope}_${targetMessage.id}.${ext}`
	const fileName = customFileName?.trim() || defaultFileName

	const meta: ChannelExportMetadata = {
		id: targetId,
		name: channelName,
		guildName,
		guildIconUrl,
		topic,
		totalMessages: selectedMsgs.length,
		exportedAt: new Date().toISOString(),
		rangeDescription:
			scope === 'before'
				? `Exported ${selectedMsgs.length} message(s) before message ${targetMessage.id}`
				: `Exported ${selectedMsgs.length} message(s) after message ${targetMessage.id}`,
	}

	const formatted = formatMessages(selectedMsgs, settings, meta)
	await exportContent(formatted, destination, fileName)
}
