import { Stores } from '@valenced/discord/flux'
import { generateDiscordChatHtml } from './htmlExporter'
import type {
	ChannelExportMetadata,
	DiscordAttachment,
	DiscordComponent,
	DiscordMessage,
	DiscordMessageSnapshot,
	DiscordReaction,
	Settings,
} from '../types'

interface DiscordRole {
	id: string
	name: string
	color?: number
	colorString?: string
	colorStrings?: {
		primaryColor?: string
		secondaryColor?: string
		tertiaryColor?: string
	}
}

interface GuildStoreInstance {
	getGuild?: (id: string) =>
		| {
				id?: string
				name?: string
				roles?: unknown
		  }
		| undefined
	getGuilds?: () =>
		| Record<
				string,
				{
					id?: string
					roles?: unknown
				}
		  >
		| undefined
}

interface GuildRoleStoreInstance {
	getRole?: (guildId: string, roleId: string) => DiscordRole | undefined
	getUnsafeMutableRoles?: (guildId: string) => unknown
	getRoles?: (guildId: string) => unknown
}

function findRoleInCollection(
	roles: unknown,
	roleId: string,
): DiscordRole | undefined {
	if (!roles) return undefined
	if (Array.isArray(roles)) {
		return roles.find(
			(r: DiscordRole) =>
				r && (r.id === roleId || (r as { roleId?: string }).roleId === roleId),
		)
	}
	if (typeof roles === 'object') {
		const record = roles as Record<string, DiscordRole>
		if (record[roleId]) return record[roleId]
		return Object.values(record).find(
			(r: DiscordRole) =>
				r && (r.id === roleId || (r as { roleId?: string }).roleId === roleId),
		)
	}
	return undefined
}

function getRoleColor(r: DiscordRole): string | undefined {
	if (r.colorString) return r.colorString
	if (typeof r.color === 'number' && r.color > 0) {
		return `#${r.color.toString(16).padStart(6, '0')}`
	}
	return r.colorStrings?.primaryColor
}

function resolveRole(
	roleId: string,
	guildId?: string,
): { name: string; color?: string } | undefined {
	const S = Stores as unknown as {
		GuildRoleStore?: GuildRoleStoreInstance
		GuildStore?: GuildStoreInstance
	}
	if (guildId) {
		const directRole = S.GuildRoleStore?.getRole?.(guildId, roleId)
		if (directRole?.name) {
			return { name: directRole.name, color: getRoleColor(directRole) }
		}

		const mutableRoles = S.GuildRoleStore?.getUnsafeMutableRoles?.(guildId)
		const r1 = findRoleInCollection(mutableRoles, roleId)
		if (r1?.name) {
			return { name: r1.name, color: getRoleColor(r1) }
		}

		const storeRoles = S.GuildRoleStore?.getRoles?.(guildId)
		const r2 = findRoleInCollection(storeRoles, roleId)
		if (r2?.name) {
			return { name: r2.name, color: getRoleColor(r2) }
		}

		const guildRoles = S.GuildStore?.getGuild?.(guildId)?.roles
		const r3 = findRoleInCollection(guildRoles, roleId)
		if (r3?.name) {
			return { name: r3.name, color: getRoleColor(r3) }
		}
	}
	const guilds = S.GuildStore?.getGuilds?.()
	if (guilds) {
		for (const [gid, g] of Object.entries(guilds)) {
			const r =
				findRoleInCollection(g.roles, roleId) ||
				S.GuildRoleStore?.getRole?.(gid, roleId) ||
				findRoleInCollection(
					S.GuildRoleStore?.getUnsafeMutableRoles?.(gid),
					roleId,
				) ||
				findRoleInCollection(S.GuildRoleStore?.getRoles?.(gid), roleId)
			if (r?.name) {
				return { name: r.name, color: getRoleColor(r) }
			}
		}
	}
	return undefined
}

export function replaceRoleMentionsInText(
	text: string,
	guildId?: string,
): string {
	if (!text) return ''
	return text.replace(/<@&(\w+)>/g, (_m, roleId) => {
		const role = resolveRole(roleId, guildId)
		return role ? `@${role.name}` : '@role'
	})
}

function getAttachmentMime(att: DiscordAttachment): string {
	if (typeof att.content_type === 'string' && att.content_type.trim()) {
		return att.content_type.trim().toLowerCase()
	}
	if (
		typeof att.original_content_type === 'string' &&
		att.original_content_type.trim()
	) {
		return att.original_content_type.trim().toLowerCase()
	}
	const lower = (att.filename || '').toLowerCase()
	if (/\.(mp4|webm|mov|m4v|mkv|avi|flv|wmv)$/i.test(lower)) return 'video/mp4'
	if (/\.(png|jpe?g|gif|webp|bmp|svg|tiff?)$/i.test(lower)) return 'image/png'
	if (/\.(mp3|wav|ogg|m4a|aac|opus)$/i.test(lower)) return 'audio/mpeg'
	return ''
}

function isVideoAttachment(att: DiscordAttachment): boolean {
	const contentType = getAttachmentMime(att)
	if (contentType.startsWith('video/')) return true
	const lower = (att.filename || '').toLowerCase()
	if (/\.(mp4|webm|mov|m4v|mkv|avi|flv|wmv)$/i.test(lower)) return true
	if (
		((att.width != null && att.width > 0) ||
			(att.height != null && att.height > 0)) &&
		!contentType.startsWith('image/') &&
		!contentType.startsWith('audio/')
	) {
		return true
	}
	return false
}

function isImageAttachment(att: DiscordAttachment): boolean {
	const contentType = getAttachmentMime(att)
	if (contentType.startsWith('image/')) return true
	const lower = (att.filename || '').toLowerCase()
	if (/\.(png|jpe?g|gif|webp|bmp|svg|tiff?)$/i.test(lower)) return true
	return false
}

function isVoiceAttachment(att: DiscordAttachment, msgFlags?: number): boolean {
	if (isVideoAttachment(att) || isImageAttachment(att)) {
		return false
	}
	const contentType = getAttachmentMime(att)
	if (
		(att.width != null && att.width > 0) ||
		(att.height != null && att.height > 0)
	) {
		return false
	}
	return Boolean(
		(msgFlags && (msgFlags & 8192) !== 0) ||
			((att.flags ?? 0) & 8192) !== 0 ||
			att.waveform ||
			(att.duration_secs !== undefined &&
				(contentType.startsWith('audio/') ||
					!contentType ||
					att.filename.endsWith('.ogg') ||
					att.filename.endsWith('.mp3') ||
					att.filename.endsWith('.wav'))),
	)
}

function filterRealReactions(msg: DiscordMessage): DiscordReaction[] {
	if (!msg.reactions || msg.reactions.length === 0) return []
	if (!msg.poll) return msg.reactions

	const pollAnswerEmojiNames = new Set<string>()
	const pollAnswerEmojiIds = new Set<string>()
	for (const ans of msg.poll.answers || []) {
		if (ans.poll_media?.emoji?.name) {
			pollAnswerEmojiNames.add(ans.poll_media.emoji.name)
		}
		if (ans.poll_media?.emoji?.id) {
			pollAnswerEmojiIds.add(ans.poll_media.emoji.id)
		}
	}

	return msg.reactions.filter(r => {
		if ((r as { is_vote?: boolean }).is_vote) return false
		if (r.emoji?.id && pollAnswerEmojiIds.has(r.emoji.id)) return false
		if (r.emoji?.name && pollAnswerEmojiNames.has(r.emoji.name)) return false
		if (pollAnswerEmojiNames.size === 0 && pollAnswerEmojiIds.size === 0) {
			return false
		}
		return true
	})
}

function parsePollResultDetails(msg: DiscordMessage): {
	question: string
	victorText: string
	victorVotes: string
	totalVotes: string
	emojiName?: string
} | null {
	if (msg.embeds && msg.embeds.length > 0) {
		const embed =
			msg.embeds.find(e => e.type === 'poll_result') || msg.embeds[0]
		if (embed?.fields && embed.fields.length > 0) {
			const getVal = (name: string): string => {
				const field = embed.fields?.find(
					f => f.name === name || f.rawName === name,
				)
				return (field?.value ?? field?.rawValue ?? '').trim()
			}
			const question = getVal('poll_question_text')
			const victorText = getVal('victor_answer_text')
			const victorVotes = getVal('victor_answer_votes')
			const totalVotes = getVal('total_votes')
			const emojiName = getVal('victor_answer_emoji_name')
			if (question || victorText) {
				return {
					question,
					victorText,
					victorVotes,
					totalVotes,
					emojiName: emojiName || undefined,
				}
			}
		}
	}
	if (msg.poll) {
		const question = msg.poll.question?.text || ''
		const answers = msg.poll.answers || []
		const counts = msg.poll.results?.answer_counts || []
		let maxVotes = -1
		let bestAnswer = answers[0]
		for (const ans of answers) {
			const c = counts.find(item => item.id === ans.answer_id)?.count ?? 0
			if (c > maxVotes) {
				maxVotes = c
				bestAnswer = ans
			}
		}
		const totalVotes = String(
			msg.poll.results?.total_votes ??
				counts.reduce((sum, item) => sum + (item.count || 0), 0),
		)
		return {
			question,
			victorText: bestAnswer?.poll_media?.text || '',
			victorVotes: maxVotes >= 0 ? String(maxVotes) : '0',
			totalVotes,
			emojiName: bestAnswer?.poll_media?.emoji?.name,
		}
	}
	return null
}

export function formatAuthorName(author: DiscordMessage['author']): string {
	if (!author) return 'Unknown Author'
	if (author.discriminator && author.discriminator !== '0') {
		return `${author.username}#${author.discriminator}`
	}
	if (author.globalName) {
		return `${author.globalName} (@${author.username})`
	}
	return author.username
}

function resolveAttachmentUrl(
	url: unknown,
	attachments?: DiscordAttachment[],
): string {
	if (typeof url !== 'string' || !url) return ''
	if (url.startsWith('attachment://')) {
		const filename = url.slice('attachment://'.length)
		const att = attachments?.find(a => a.filename === filename)
		if (att) {
			return att.proxy_url || att.url
		}
	}
	return url
}

function formatComponentToText(
	comp: DiscordComponent | null | undefined,
	indent = '    ',
	depth = 0,
	attachments?: DiscordAttachment[],
): string[] {
	if (!comp || depth > 10) return []
	const lines: string[] = []
	const typeNum = Number(comp.type)

	if (typeNum === 17 || comp.type === 'container') {
		const accent = comp.accent_color
			? ` [Color: #${comp.accent_color.toString(16).padStart(6, '0')}]`
			: ''
		const spoiler = comp.spoiler ? ' (Spoiler)' : ''
		lines.push(`${indent}[Container${accent}${spoiler}]:`)
		if (Array.isArray(comp.components)) {
			for (const child of comp.components) {
				lines.push(
					...formatComponentToText(
						child,
						`${indent}  `,
						depth + 1,
						attachments,
					),
				)
			}
		}
		return lines
	}

	if (typeNum === 9 || comp.type === 'section') {
		lines.push(`${indent}[Section]:`)
		if (Array.isArray(comp.components)) {
			for (const child of comp.components) {
				lines.push(
					...formatComponentToText(
						child,
						`${indent}  `,
						depth + 1,
						attachments,
					),
				)
			}
		}
		if (comp.accessory) {
			lines.push(`${indent}  Accessory:`)
			lines.push(
				...formatComponentToText(
					comp.accessory,
					`${indent}    `,
					depth + 1,
					attachments,
				),
			)
		}
		return lines
	}

	if (typeNum === 10 || comp.type === 'text_display') {
		if (comp.content) {
			lines.push(`${indent}• ${comp.content}`)
		}
		return lines
	}

	if (typeNum === 1 || comp.type === 'action_row') {
		if (Array.isArray(comp.components)) {
			for (const child of comp.components) {
				lines.push(
					...formatComponentToText(child, indent, depth + 1, attachments),
				)
			}
		}
		return lines
	}

	if (typeNum === 2 || comp.type === 'button') {
		const label = comp.label || ''
		const urlPart = comp.url ? ` -> ${comp.url}` : ''
		const disabledPart = comp.disabled ? ' (Disabled)' : ''
		lines.push(`${indent}[Button: ${label}${urlPart}${disabledPart}]`)
		return lines
	}

	if (
		typeNum === 3 ||
		typeNum === 5 ||
		typeNum === 6 ||
		typeNum === 7 ||
		typeNum === 8 ||
		comp.type === 'select'
	) {
		const ph = comp.placeholder || 'Select...'
		const opts = comp.options?.map(o => o.label || o.value).join(', ')
		const optStr = opts ? ` (${opts})` : ''
		lines.push(`${indent}[Select: ${ph}${optStr}]`)
		return lines
	}

	if (typeNum === 11 || comp.type === 'thumbnail') {
		const rawUrl =
			comp.media?.url ||
			(typeof comp.media === 'string' ? comp.media : '') ||
			comp.url ||
			''
		const url = resolveAttachmentUrl(rawUrl, attachments)
		lines.push(`${indent}[Thumbnail: ${url}]`)
		return lines
	}

	if (typeNum === 12 || comp.type === 'media_gallery') {
		const items = comp.items
			?.map(it => {
				const rawUrl =
					it.media?.url ||
					(typeof it.media === 'string' ? it.media : '') ||
					it.url ||
					''
				return resolveAttachmentUrl(rawUrl, attachments)
			})
			.filter(Boolean)
			.join(', ')
		lines.push(`${indent}[Media Gallery: ${items}]`)
		return lines
	}

	if (typeNum === 13 || comp.type === 'file') {
		let rawUrl = comp.file?.url || comp.url || ''
		let filename = comp.filename || comp.file?.filename || 'File'
		if (rawUrl.startsWith('attachment://')) {
			const attName = rawUrl.slice('attachment://'.length)
			const att = attachments?.find(a => a.filename === attName)
			if (att) {
				rawUrl = att.proxy_url || att.url
				if (!comp.filename && !comp.file?.filename) filename = att.filename
			}
		}
		lines.push(`${indent}[File: ${filename}${rawUrl ? ` (${rawUrl})` : ''}]`)
		return lines
	}

	if (typeNum === 14 || comp.type === 'separator') {
		lines.push(`${indent}---`)
		return lines
	}

	return lines
}

function getSystemMessageText(msg: DiscordMessage): string | null {
	const typeNum = Number(msg.type ?? 0)
	if (
		typeNum === 0 ||
		typeNum === 19 ||
		typeNum === 20 ||
		typeNum === 23 ||
		(msg.messageSnapshots && msg.messageSnapshots.length > 0) ||
		(msg.message_snapshots && msg.message_snapshots.length > 0)
	) {
		return null
	}
	if (typeNum === 1) {
		const recipient = msg.mentions?.[0]
		const recipientName = recipient
			? recipient.globalName || recipient.global_name || recipient.username
			: ''
		return recipientName
			? `added ${recipientName} to the group.`
			: 'added a recipient to the group.'
	}
	if (typeNum === 2) {
		const recipient = msg.mentions?.[0]
		const recipientName = recipient
			? recipient.globalName || recipient.global_name || recipient.username
			: ''
		return recipientName
			? `removed ${recipientName} from the group.`
			: 'removed a recipient from the group.'
	}
	if (typeNum === 3) {
		const mins = msg.call?.duration
			? Math.max(1, Math.round(msg.call.duration / 60))
			: 0
		return mins > 0
			? `started a call that lasted ${mins} min.`
			: 'started a call.'
	}
	if (typeNum === 4) {
		return msg.content
			? `changed the channel name: ${msg.content}`
			: 'changed the channel name.'
	}
	if (typeNum === 5) return 'changed the channel icon.'
	if (typeNum === 6) return 'pinned a message to this channel.'
	if (typeNum === 7) return 'joined the server.'
	if (typeNum === 8) return 'boosted the server!'
	if (typeNum >= 9 && typeNum <= 11) {
		return `boosted the server to Tier ${typeNum - 7}!`
	}
	if (typeNum === 12) return 'added a channel follow to this channel.'
	if (typeNum === 18) {
		return msg.content
			? `started a thread: ${msg.content}`
			: 'started a thread.'
	}
	if (typeNum === 21) return 'started a thread starter message.'
	if (typeNum === 22) return 'reminded the server about guild invites.'
	if (typeNum === 24) return 'AutoMod caught a message.'
	if (typeNum === 25) return 'subscribed to the server.'
	if (typeNum === 27) return 'started a stage.'
	if (typeNum === 28) return 'ended a stage.'
	if (typeNum === 29) return 'became a speaker in the stage.'
	if (typeNum === 31) {
		return msg.content
			? `changed the stage topic: ${msg.content}`
			: 'changed the stage topic.'
	}
	if (typeNum === 32) return 'added an integration to this channel.'
	if (typeNum === 36 || typeNum === 44) {
		return 'purchased an item from the server shop.'
	}
	if (typeNum === 46) {
		const details = parsePollResultDetails(msg)
		if (details) {
			const emojiText = details.emojiName ? `${details.emojiName} ` : ''
			const votesStr = details.totalVotes
				? `(${details.victorVotes}/${details.totalVotes} votes)`
				: `(${details.victorVotes} votes)`
			return `Poll "${details.question}" ended. Winner: ${emojiText}${details.victorText} ${votesStr}`
		}
		return 'poll ended.'
	}

	return 'system action performed.'
}

function formatSnapshotsToText(
	snapshots: DiscordMessageSnapshot[],
	parts: string[],
	settings: Settings,
	indent = '  ',
	depth = 0,
	guildId?: string,
): void {
	if (!Array.isArray(snapshots) || snapshots.length === 0 || depth > 5) return
	parts.push(`${indent}[Forwarded Message]:`)
	for (const snap of snapshots) {
		const snapMsg = (snap?.message ?? snap) as DiscordMessage
		let snapHeader = `${indent}  `
		if (settings.includeTimestamps && snapMsg.timestamp) {
			const date = new Date(snapMsg.timestamp)
			if (!Number.isNaN(date.getTime())) {
				snapHeader += `[${date.toLocaleString()}] `
			}
		}
		if (snapMsg.author?.username && snapMsg.author.username !== 'Unknown') {
			snapHeader += `${formatAuthorName(snapMsg.author)}: `
		}
		let snapContent = replaceRoleMentionsInText(snapMsg.content ?? '', guildId)
		if (snapMsg.editedTimestamp || snapMsg.edited_timestamp) {
			snapContent += ' (edited)'
		}
		if (snapContent || snapMsg.author?.username || snapHeader.trim()) {
			parts.push(`${snapHeader}${snapContent}`.trimEnd())
		}
		if (
			settings.includeAttachments &&
			snapMsg.attachments &&
			snapMsg.attachments.length > 0
		) {
			parts.push(`${indent}    Attachments:`)
			for (const att of snapMsg.attachments) {
				const sizeStr = att.size ? ` (${(att.size / 1024).toFixed(1)} KB)` : ''
				const voiceStr = isVoiceAttachment(att, snapMsg.flags)
					? ' [Voice Message]'
					: ''
				const url = att.url || att.proxy_url || ''
				parts.push(
					`${indent}      - ${att.filename}${voiceStr}${sizeStr}: ${url}`,
				)
			}
		}
		if (settings.includeEmbeds && snapMsg.embeds && snapMsg.embeds.length > 0) {
			parts.push(`${indent}    Embeds:`)
			for (const embed of snapMsg.embeds) {
				if (embed.title) {
					parts.push(`${indent}      - Title: ${embed.title}`)
				}
				if (embed.url) {
					parts.push(`${indent}        URL: ${embed.url}`)
				}
				if (embed.description) {
					parts.push(
						`${indent}        Description: ${replaceRoleMentionsInText(embed.description, guildId)}`,
					)
				}
				if (embed.fields && embed.fields.length > 0) {
					for (const field of embed.fields) {
						parts.push(
							`${indent}        • ${field.name ?? field.rawName ?? ''}: ${replaceRoleMentionsInText(field.value ?? field.rawValue ?? '', guildId)}`,
						)
					}
				}
			}
		}
		if (
			(settings.includeComponents ?? true) &&
			snapMsg.components &&
			snapMsg.components.length > 0
		) {
			parts.push(`${indent}    Components:`)
			for (const comp of snapMsg.components) {
				parts.push(
					...formatComponentToText(
						comp,
						`${indent}      `,
						0,
						snapMsg.attachments,
					),
				)
			}
		}
		if (snapMsg.poll) {
			parts.push(
				`${indent}    [Poll]: ${snapMsg.poll.question?.text ?? 'Poll'}`,
			)
			for (const ans of snapMsg.poll.answers || []) {
				const count =
					snapMsg.poll.results?.answer_counts?.find(c => c.id === ans.answer_id)
						?.count ?? 0
				const emojiText = ans.poll_media?.emoji?.name
					? `${ans.poll_media.emoji.name} `
					: ''
				parts.push(
					`${indent}      - ${emojiText}${ans.poll_media?.text ?? ''} (${count} votes)`,
				)
			}
		}
		const snapStickers =
			snapMsg.stickerItems || snapMsg.stickers || snapMsg.sticker_items
		if (Array.isArray(snapStickers) && snapStickers.length > 0) {
			for (const st of snapStickers) {
				parts.push(`${indent}    [Sticker: ${st.name}]`)
			}
		}
		const nestedSnapshots =
			snapMsg.messageSnapshots || snapMsg.message_snapshots
		if (Array.isArray(nestedSnapshots) && nestedSnapshots.length > 0) {
			formatSnapshotsToText(
				nestedSnapshots,
				parts,
				settings,
				`${indent}    `,
				depth + 1,
				guildId,
			)
		}
	}
}

export function formatMessageToText(
	message: DiscordMessage,
	settings: Settings,
): string {
	const sysText = getSystemMessageText(message)
	if (sysText) {
		let prefix = ''
		if (settings.includeTimestamps && message.timestamp) {
			const date = new Date(message.timestamp)
			if (!Number.isNaN(date.getTime())) {
				prefix = `[${date.toLocaleString()}] `
			}
		}
		return `${prefix}[System]: ${formatAuthorName(message.author)} ${sysText}`
	}

	const parts: string[] = []

	let header = ''
	if (settings.includeTimestamps && message.timestamp) {
		const date = new Date(message.timestamp)
		if (!Number.isNaN(date.getTime())) {
			header += `[${date.toLocaleString()}] `
		}
	}
	if (message.pinned) {
		header += '[Pinned] '
	}
	header += formatAuthorName(message.author)
	const interName =
		message.interactionMetadata?.name || message.interaction?.name
	if (interName) {
		header += ` [Used /${interName}]`
	}
	header += ':'

	const guildId = message.channel_id
		? (
				Stores?.ChannelStore as unknown as
					| { getChannel?: (id: string) => { guild_id?: string } | undefined }
					| undefined
			)?.getChannel?.(message.channel_id)?.guild_id
		: undefined

	let body = replaceRoleMentionsInText(message.content ?? '', guildId)
	if (message.editedTimestamp || message.edited_timestamp) {
		body += ' (edited)'
	}
	parts.push(`${header} ${body}`.trimEnd())

	const isForward = Boolean(
		(message.messageSnapshots && message.messageSnapshots.length > 0) ||
			(message.message_snapshots && message.message_snapshots.length > 0) ||
			message.messageReference?.type === 1,
	)
	if (message.referencedMessage && !isForward) {
		const refAuthor = formatAuthorName(message.referencedMessage.author)
		const refContent = message.referencedMessage.content
			? message.referencedMessage.content.slice(0, 60)
			: message.referencedMessage.attachments?.length
				? 'Attachment'
				: 'Message'
		parts.push(`  [Replying to ${refAuthor}: ${refContent}]`)
	}

	if (
		settings.includeAttachments &&
		message.attachments &&
		message.attachments.length > 0
	) {
		parts.push('  Attachments:')
		for (const attachment of message.attachments) {
			const sizeStr = attachment.size
				? ` (${(attachment.size / 1024).toFixed(1)} KB)`
				: ''
			const voiceStr = isVoiceAttachment(attachment, message.flags)
				? ' [Voice Message]'
				: ''
			const url = attachment.url || attachment.proxy_url || ''
			parts.push(`    - ${attachment.filename}${voiceStr}${sizeStr}: ${url}`)
		}
	}

	const suppressEmbeds = Boolean(message.flags && (message.flags & 4) !== 0)
	if (
		settings.includeEmbeds &&
		!suppressEmbeds &&
		message.embeds &&
		message.embeds.length > 0
	) {
		parts.push('  Embeds:')
		for (const embed of message.embeds) {
			if (embed.title) {
				parts.push(`    - Title: ${embed.title}`)
			}
			if (embed.url) {
				parts.push(`      URL: ${embed.url}`)
			}
			if (embed.description) {
				parts.push(
					`      Description: ${replaceRoleMentionsInText(embed.description, guildId)}`,
				)
			}
			if (embed.fields && embed.fields.length > 0) {
				for (const field of embed.fields) {
					parts.push(
						`      • ${field.name ?? field.rawName ?? ''}: ${replaceRoleMentionsInText(field.value ?? field.rawValue ?? '', guildId)}`,
					)
				}
			}
		}
	}

	if (
		(settings.includeComponents ?? true) &&
		message.components &&
		message.components.length > 0
	) {
		parts.push('  Components:')
		for (const comp of message.components) {
			parts.push(...formatComponentToText(comp, '    ', 0, message.attachments))
		}
	}

	if (message.poll) {
		parts.push(`  [Poll]: ${message.poll.question?.text ?? 'Poll'}`)
		for (const ans of message.poll.answers || []) {
			const count =
				message.poll.results?.answer_counts?.find(c => c.id === ans.answer_id)
					?.count ?? 0
			const emojiText = ans.poll_media?.emoji?.name
				? `${ans.poll_media.emoji.name} `
				: ''
			parts.push(
				`    - ${emojiText}${ans.poll_media?.text ?? ''} (${count} votes)`,
			)
		}
	}

	const stickers =
		message.stickerItems || message.stickers || message.sticker_items
	if (Array.isArray(stickers) && stickers.length > 0) {
		for (const st of stickers) {
			parts.push(`  [Sticker: ${st.name}]`)
		}
	}

	const visibleReactions = filterRealReactions(message)
	if (visibleReactions.length > 0) {
		const rStr = visibleReactions
			.map(r => `${r.emoji.name} (${r.count})`)
			.join(', ')
		parts.push(`  Reactions: ${rStr}`)
	}

	const snapshots = message.messageSnapshots || message.message_snapshots
	if (Array.isArray(snapshots) && snapshots.length > 0) {
		formatSnapshotsToText(snapshots, parts, settings, '  ', 0, guildId)
	}

	return parts.join('\n')
}

export function formatMessagesToText(
	messages: DiscordMessage[],
	settings: Settings,
	meta: ChannelExportMetadata,
): string {
	const lines: string[] = [
		`# Chat Export: ${meta.name}`,
		meta.guildName ? `Server: ${meta.guildName}` : '',
		meta.topic ? `Topic: ${meta.topic}` : '',
		`Exported At: ${meta.exportedAt}`,
		`Total Messages: ${messages.length}`,
		'='.repeat(50),
		'',
	].filter(Boolean)

	for (const msg of messages) {
		lines.push(formatMessageToText(msg, settings))
		lines.push('')
	}

	return lines.join('\n')
}

function sanitizeComponentsForJson(
	value: unknown,
	seen = new WeakSet<object>(),
	depth = 0,
): unknown {
	if (depth > 10 || value === undefined) return undefined
	if (value === null || typeof value !== 'object') return value
	if (seen.has(value as object)) return '[Circular]'
	seen.add(value as object)

	if (Array.isArray(value)) {
		return value
			.map(item => sanitizeComponentsForJson(item, seen, depth + 1))
			.filter(item => item !== undefined)
	}

	const result: Record<string, unknown> = {}
	for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
		if (typeof val === 'function') continue
		if (typeof val === 'object' && val !== null) {
			result[key] = sanitizeComponentsForJson(val, seen, depth + 1)
		} else {
			result[key] = val
		}
	}
	return result
}

export function formatMessageToJson(
	message: DiscordMessage,
	settings: Settings,
): string {
	const output: Record<string, unknown> = {
		id: message.id,
		channel_id: message.channel_id,
		type: message.type ?? 0,
		author: {
			id: message.author.id,
			username: message.author.username,
			discriminator: message.author.discriminator,
			globalName: message.author.globalName,
			bot: message.author.bot,
			avatar: message.author.avatar,
		},
		content: message.content ?? '',
		pinned: Boolean(message.pinned),
	}

	if (message.flags !== undefined) {
		output.flags = message.flags
	}

	if (settings.includeTimestamps && message.timestamp) {
		output.timestamp = message.timestamp
	}

	const edited = message.editedTimestamp ?? message.edited_timestamp
	if (settings.includeTimestamps && edited) {
		output.editedTimestamp = edited
	}

	if (message.messageReference) {
		output.messageReference = message.messageReference
	}

	const inter = message.interactionMetadata || message.interaction
	if (inter) {
		output.interaction = inter
	}

	if (settings.includeAttachments && message.attachments) {
		output.attachments = message.attachments.map(att => ({
			filename: att.filename,
			url: att.url,
			proxy_url: att.proxy_url,
			size: att.size,
			contentType: att.content_type,
			duration_secs: att.duration_secs,
		}))
	}

	if (settings.includeEmbeds && message.embeds) {
		output.embeds = message.embeds.map(emb => ({
			title: emb.title,
			description: emb.description,
			url: emb.url,
			fields: emb.fields,
			color: emb.color,
		}))
	}

	if (
		(settings.includeComponents ?? true) &&
		message.components &&
		message.components.length > 0
	) {
		output.components = sanitizeComponentsForJson(message.components)
	}

	if (message.poll) {
		output.poll = sanitizeComponentsForJson(message.poll)
	}

	const stickers =
		message.stickerItems || message.stickers || message.sticker_items
	if (Array.isArray(stickers) && stickers.length > 0) {
		output.stickerItems = stickers
	}

	const visibleReactions = filterRealReactions(message)
	if (visibleReactions.length > 0) {
		output.reactions = visibleReactions
	}

	const snapshots = message.messageSnapshots || message.message_snapshots
	if (Array.isArray(snapshots) && snapshots.length > 0) {
		output.messageSnapshots = sanitizeComponentsForJson(snapshots)
	}

	return JSON.stringify(output, null, 2)
}

export function formatMessagesToJson(
	messages: DiscordMessage[],
	settings: Settings,
	meta: ChannelExportMetadata,
): string {
	const formattedMessages = messages.map(msg =>
		JSON.parse(formatMessageToJson(msg, settings)),
	)
	const result = {
		meta,
		messages: formattedMessages,
	}
	return JSON.stringify(result, null, 2)
}

export function formatMessage(
	message: DiscordMessage,
	settings: Settings,
): string {
	if (settings.format === 'html') {
		const meta: ChannelExportMetadata = {
			id: message.channel_id ?? '0',
			name: 'Message Export',
			totalMessages: 1,
			exportedAt: new Date().toISOString(),
		}
		return generateDiscordChatHtml(meta, [message], settings)
	}
	if (settings.format === 'json') {
		return formatMessageToJson(message, settings)
	}
	return formatMessageToText(message, settings)
}

export function formatMessages(
	messages: DiscordMessage[],
	settings: Settings,
	meta: ChannelExportMetadata,
): string {
	if (settings.format === 'html') {
		return generateDiscordChatHtml(meta, messages, settings)
	}
	if (settings.format === 'json') {
		return formatMessagesToJson(messages, settings, meta)
	}
	return formatMessagesToText(messages, settings, meta)
}
