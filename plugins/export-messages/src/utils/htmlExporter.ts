import { Stores } from '@valenced/discord/flux'
import type {
	ChannelExportMetadata,
	DiscordAttachment,
	DiscordAuthor,
	DiscordComponent,
	DiscordComponentEmoji,
	DiscordEmbed,
	DiscordMessage,
	DiscordMessageSnapshot,
	DiscordPoll,
	DiscordReaction,
	DiscordStickerItem,
	Settings,
} from '../types'

function escapeHtml(text: unknown): string {
	if (typeof text !== 'string') {
		return text == null ? '' : String(text)
	}
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
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

interface UserStoreInstance {
	getUser?: (id: string) =>
		| {
				id: string
				username: string
				globalName?: string
		  }
		| undefined
}

interface ChannelStoreInstance {
	getChannel?: (id: string) =>
		| {
				id: string
				name: string
				guild_id?: string
		  }
		| undefined
}

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

function parsePollResultDetails(msg: DiscordMessage): {
	question: string
	victorText: string
	victorVotes: string
	totalVotes: string
	emojiName?: string
	emojiId?: string
	emojiAnimated?: boolean
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
			const emojiId = getVal('victor_answer_emoji_id')
			const emojiAnimated = getVal('victor_answer_emoji_animated') === 'true'
			if (question || victorText) {
				return {
					question,
					victorText,
					victorVotes,
					totalVotes,
					emojiName: emojiName || undefined,
					emojiId: emojiId || undefined,
					emojiAnimated,
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
			emojiId: bestAnswer?.poll_media?.emoji?.id,
			emojiAnimated: bestAnswer?.poll_media?.emoji?.animated,
		}
	}
	return null
}

function formatDiscordTimestamp(unixSecStr: string, formatStyle = 'f'): string {
	const sec = Number.parseInt(unixSecStr, 10)
	if (Number.isNaN(sec) || sec <= 0) return unixSecStr

	const date = new Date(sec * 1000)
	const now = Date.now()
	const diffSec = Math.round((sec * 1000 - now) / 1000)

	if (formatStyle === 'R') {
		const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
		const absDiff = Math.abs(diffSec)
		if (absDiff < 60) return rtf.format(diffSec, 'second')
		if (absDiff < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
		if (absDiff < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
		return rtf.format(Math.round(diffSec / 86400), 'day')
	}

	if (formatStyle === 't') {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
	}
	if (formatStyle === 'T') {
		return date.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		})
	}
	if (formatStyle === 'd') {
		return date.toLocaleDateString()
	}
	if (formatStyle === 'D') {
		return date.toLocaleDateString([], {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
		})
	}
	if (formatStyle === 'F') {
		return `${date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
	}
	return `${date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function parseMarkdown(
	text: string,
	userMap: Map<string, string>,
	channelMap: Map<string, string>,
	roleMap?: Map<string, { name: string; color?: string }>,
	guildId?: string,
): string {
	if (!text) return ''

	const tokens: string[] = []
	const stash = (html: string): string => {
		const index = tokens.length
		tokens.push(html)
		return `\u0000TOK_${index}\u0000`
	}

	let safe = escapeHtml(text)

	const trimmed = text.trim()
	const emojiMatch = trimmed.match(/^(?:<(?:a)?:[a-zA-Z0-9_]+:\d+>\s*){1,5}$/)
	const isJumbo = Boolean(emojiMatch)

	safe = safe.replace(
		/```(?:([a-zA-Z0-9_-]+)\n)?([\s\S]*?)```/g,
		(_m, lang, code) => {
			const langAttr = lang ? ` language-${lang}` : ' nohighlight'
			return stash(
				`<code class="chatlog__markdown-pre chatlog__markdown-pre--multiline${langAttr}">${code.trim()}</code>`,
			)
		},
	)

	safe = safe.replace(/`([^`\n]+)`/g, (_m, code) => {
		return stash(
			`<code class="chatlog__markdown-pre chatlog__markdown-pre--inline">${code}</code>`,
		)
	})

	safe = safe.replace(
		/&lt;(a)?:([a-zA-Z0-9_]+):(\d+)&gt;/g,
		(_m, isAnimated, name, id) => {
			const ext = isAnimated ? 'gif' : 'webp'
			const url = `https://cdn.discordapp.com/emojis/${id}.${ext}?size=64&quality=lossless`
			const jumboClass = isJumbo ? ' chatlog__emoji--large' : ''
			return stash(
				`<img class="chatlog__emoji${jumboClass}" src="${url}" alt=":${name}:" title=":${name}:" loading="lazy" />`,
			)
		},
	)

	safe = safe.replace(/(https?:\/\/[^\s<]+)/g, (_m, url) => {
		return stash(
			`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
		)
	})

	safe = safe.replace(
		/&lt;t:(\d+)(?::([tTdDfFR]))?&gt;/g,
		(_m, unixSec, style) => {
			const formatted = formatDiscordTimestamp(unixSec, style || 'f')
			const fullDate = new Date(
				Number.parseInt(unixSec, 10) * 1000,
			).toLocaleString()
			return stash(
				`<span class="chatlog__markdown-timestamp" title="${fullDate}">${formatted}</span>`,
			)
		},
	)

	safe = safe.replace(/&lt;@!?(\d+)&gt;/g, (_m, userId) => {
		let name = userMap.get(userId)
		if (!name) {
			const u = (
				Stores.UserStore as unknown as UserStoreInstance | undefined
			)?.getUser?.(userId)
			if (u) {
				name = u.globalName || u.username
				userMap.set(userId, name)
			}
		}
		const display = name ? `@${name}` : `@User (${userId.slice(-4)})`
		return stash(
			`<span class="chatlog__markdown-mention" title="${escapeHtml(name || userId)}">${escapeHtml(display)}</span>`,
		)
	})

	safe = safe.replace(/&lt;#(\d+)&gt;/g, (_m, channelId) => {
		let chName = channelMap.get(channelId)
		if (!chName) {
			const ch = (
				Stores.ChannelStore as unknown as ChannelStoreInstance | undefined
			)?.getChannel?.(channelId)
			if (ch) {
				chName = ch.name
				channelMap.set(channelId, chName)
			}
		}
		const display = chName ? `#${chName}` : `#channel`
		return stash(
			`<span class="chatlog__markdown-mention">${escapeHtml(display)}</span>`,
		)
	})

	safe = safe.replace(/&lt;@&amp;(\w+)&gt;/g, (_m, roleId) => {
		let role = roleMap?.get(roleId)
		if (!role) {
			role = resolveRole(roleId, guildId)
			if (role && roleMap) {
				roleMap.set(roleId, role)
			}
		}
		if (role) {
			const colorStyle = role.color ? ` style="color: ${role.color};"` : ''
			return stash(
				`<span class="chatlog__markdown-mention chatlog__markdown-mention--role"${colorStyle}>@${escapeHtml(role.name)}</span>`,
			)
		}
		return stash('<span class="chatlog__markdown-mention">@role</span>')
	})

	safe = safe.replace(/@everyone/g, () =>
		stash('<span class="chatlog__markdown-mention">@everyone</span>'),
	)
	safe = safe.replace(/@here/g, () =>
		stash('<span class="chatlog__markdown-mention">@here</span>'),
	)

	safe = safe.replace(
		/\|\|([\s\S]*?)\|\|/g,
		'<span class="chatlog__markdown-spoiler chatlog__markdown-spoiler--hidden" onclick="showSpoiler(event, this)">$1</span>',
	)

	safe = safe.replace(/^### (.*)$/gm, '<h3>$1</h3>')
	safe = safe.replace(/^## (.*)$/gm, '<h2>$1</h2>')
	safe = safe.replace(/^# (.*)$/gm, '<h1>$1</h1>')

	safe = safe.replace(
		/^-# (.*)$/gm,
		'<div class="chatlog__markdown-subtext">$1</div>',
	)

	safe = safe.replace(
		/^&gt;&gt;&gt;\s*([\s\S]*)$/m,
		'<div class="chatlog__markdown-quote"><div class="chatlog__markdown-quote-border"></div><div class="chatlog__markdown-quote-content">$1</div></div>',
	)

	safe = safe.replace(
		/^&gt;\s?(.*)$/gm,
		'<div class="chatlog__markdown-quote"><div class="chatlog__markdown-quote-border"></div><div class="chatlog__markdown-quote-content">$1</div></div>',
	)

	safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
	safe = safe.replace(/__([^_]+)__/g, '<u>$1</u>')
	safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>')
	safe = safe.replace(/(^|\s)_([^_]+)_(\s|$)/g, '$1<em>$2</em>$3')
	safe = safe.replace(/~~([^~]+)~~/g, '<s>$1</s>')

	safe = safe.replace(/\n/g, '<br>')

	for (let i = tokens.length - 1; i >= 0; i--) {
		safe = safe.replaceAll(`\u0000TOK_${i}\u0000`, tokens[i])
	}

	return safe
}

function getAvatarUrl(
	author: DiscordMessage['author'],
	defaultIndex = 0,
): string {
	if (author?.id && author?.avatar) {
		const isGif = author.avatar.startsWith('a_')
		const ext = isGif ? 'gif' : 'webp'
		return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.${ext}?size=128`
	}
	const fallbackNum = defaultIndex % 6
	return `https://cdn.discordapp.com/embed/avatars/${fallbackNum}.png`
}

function formatFileSize(bytes?: number): string {
	if (!bytes || bytes <= 0) return ''
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

function isAudioAttachment(att: DiscordAttachment, msgFlags?: number): boolean {
	if (
		isVoiceAttachment(att, msgFlags) ||
		isVideoAttachment(att) ||
		isImageAttachment(att)
	) {
		return false
	}
	const contentType = getAttachmentMime(att)
	if (contentType.startsWith('audio/')) return true
	const lower = (att.filename || '').toLowerCase()
	return /\.(mp3|wav|ogg|m4a|aac|opus)$/i.test(lower)
}

function renderMosaicItem(attachment: DiscordAttachment): string {
	const filename = escapeHtml(attachment.filename)
	const url = escapeHtml(attachment.url || attachment.proxy_url || '')
	const isSpoiler = attachment.filename.startsWith('SPOILER_')
	const hiddenClass = isSpoiler ? ' chatlog__attachment--hidden' : ''
	const spoilerBadge = isSpoiler
		? '<div class="chatlog__attachment-spoiler-caption">SPOILER</div>'
		: ''
	if (isVideoAttachment(attachment)) {
		return `<div class="chatlog__attachment-mosaic-item chatlog__attachment${hiddenClass}" ${isSpoiler ? 'onclick="showSpoiler(event, this)"' : ''}>${spoilerBadge}<video class="chatlog__attachment-media" controls preload="metadata" src="${url}"></video></div>`
	}
	return `<div class="chatlog__attachment-mosaic-item chatlog__attachment${hiddenClass}" ${isSpoiler ? 'onclick="showSpoiler(event, this)"' : ''}>${spoilerBadge}<img class="chatlog__attachment-media" src="${url}" alt="${filename}" loading="lazy" onclick="if (!this.closest('.chatlog__attachment--hidden')) openLightbox(this.src)" /></div>`
}

function renderAttachment(
	attachment: DiscordAttachment,
	msgFlags?: number,
): string {
	const filename = escapeHtml(attachment.filename)
	const url = escapeHtml(attachment.url || attachment.proxy_url || '')
	const size = formatFileSize(attachment.size)

	if (isVoiceAttachment(attachment, msgFlags)) {
		const durSec = attachment.duration_secs
			? Math.round(attachment.duration_secs)
			: 0
		const durStr = durSec > 0 ? ` (${durSec}s)` : ''
		return `<div class="chatlog__attachment chatlog__attachment--voice"><div class="chatlog__voice-badge"><svg class="chatlog__voice-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path fill="currentColor" d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg><span>Voice Message${durStr}</span></div><audio class="chatlog__attachment-audio" controls preload="metadata" src="${url}"></audio></div>`
	}

	if (isImageAttachment(attachment)) {
		const isSpoiler = attachment.filename.startsWith('SPOILER_')
		const hiddenClass = isSpoiler ? ' chatlog__attachment--hidden' : ''
		const spoilerBadge = isSpoiler
			? '<div class="chatlog__attachment-spoiler-caption">SPOILER</div>'
			: ''
		return `<div class="chatlog__attachment${hiddenClass}" ${isSpoiler ? 'onclick="showSpoiler(event, this)"' : ''}>${spoilerBadge}<img class="chatlog__attachment-media" src="${url}" alt="${filename}" loading="lazy" onclick="if (!this.closest('.chatlog__attachment--hidden')) openLightbox(this.src)" /><div class="chatlog__attachment-info">${filename} ${size ? `(${size})` : ''}</div></div>`
	}

	if (isVideoAttachment(attachment)) {
		return `<div class="chatlog__attachment"><video class="chatlog__attachment-media" controls preload="metadata" src="${url}"></video><div class="chatlog__attachment-info">${filename} ${size ? `(${size})` : ''}</div></div>`
	}

	if (isAudioAttachment(attachment, msgFlags)) {
		return `<div class="chatlog__attachment"><audio class="chatlog__attachment-audio" controls preload="metadata" src="${url}"></audio><div class="chatlog__attachment-info">${filename} ${size ? `(${size})` : ''}</div></div>`
	}

	return `<div class="chatlog__attachment-generic"><svg class="chatlog__attachment-generic-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg><div class="chatlog__attachment-generic-details"><a class="chatlog__attachment-generic-name" href="${url}" target="_blank" rel="noopener noreferrer">${filename}</a>${size ? `<span class="chatlog__attachment-generic-size">${size}</span>` : ''}</div></div>`
}

function renderAttachments(
	attachments: DiscordAttachment[],
	msgFlags?: number,
): string {
	if (!attachments || attachments.length === 0) return ''
	const visualMedia: DiscordAttachment[] = []
	const otherAttachments: DiscordAttachment[] = []
	for (const a of attachments) {
		if (isImageAttachment(a) || isVideoAttachment(a)) {
			visualMedia.push(a)
		} else {
			otherAttachments.push(a)
		}
	}
	let mosaicHtml = ''
	let singleVisualHtml = ''
	if (visualMedia.length >= 2) {
		const count = Math.min(visualMedia.length, 5)
		const items = visualMedia.map(renderMosaicItem).join('')
		mosaicHtml = `<div class="chatlog__attachment-mosaic chatlog__attachment-mosaic--${count}">${items}</div>`
	} else if (visualMedia.length === 1) {
		singleVisualHtml = renderAttachment(visualMedia[0], msgFlags)
	}
	const otherHtml = otherAttachments
		.map(a => renderAttachment(a, msgFlags))
		.join('')
	return `<div class="chatlog__attachments">${mosaicHtml}${singleVisualHtml}${otherHtml}</div>`
}

function renderEmbed(
	embed: DiscordEmbed,
	userMap: Map<string, string>,
	channelMap: Map<string, string>,
	roleMap?: Map<string, { name: string; color?: string }>,
	guildId?: string,
): string {
	const colorHex = embed.color
		? `#${embed.color.toString(16).padStart(6, '0')}`
		: '#202225'

	const authorHtml = embed.author?.name
		? `<div class="chatlog__embed-author-container">${embed.author.icon_url ? `<img class="chatlog__embed-author-icon" src="${escapeHtml(embed.author.icon_url)}" alt="" loading="lazy" />` : ''}<span class="chatlog__embed-author">${escapeHtml(embed.author.name)}</span></div>`
		: ''

	const titleHtml = embed.title
		? embed.url
			? `<div class="chatlog__embed-title"><a href="${escapeHtml(embed.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(embed.title)}</a></div>`
			: `<div class="chatlog__embed-title">${escapeHtml(embed.title)}</div>`
		: ''

	const descHtml = embed.description
		? `<div class="chatlog__embed-description">${parseMarkdown(embed.description, userMap, channelMap, roleMap, guildId)}</div>`
		: ''

	let fieldsHtml = ''
	if (embed.fields && embed.fields.length > 0) {
		const fieldItems = embed.fields
			.map(
				f =>
					`<div class="chatlog__embed-field ${f.inline ? 'chatlog__embed-field--inline' : ''}"><div class="chatlog__embed-field-name">${escapeHtml(f.name ?? f.rawName ?? '')}</div><div class="chatlog__embed-field-value">${parseMarkdown(f.value ?? f.rawValue ?? '', userMap, channelMap, roleMap, guildId)}</div></div>`,
			)
			.join('')
		fieldsHtml = `<div class="chatlog__embed-fields">${fieldItems}</div>`
	}

	const thumbnailHtml = embed.thumbnail?.url
		? `<img class="chatlog__embed-thumbnail" src="${escapeHtml(embed.thumbnail.url)}" alt="Thumbnail" loading="lazy" />`
		: ''

	const imageHtml = embed.image?.url
		? `<div class="chatlog__embed-images chatlog__embed-images--single"><img class="chatlog__embed-image" src="${escapeHtml(embed.image.url)}" alt="Image" loading="lazy" onclick="openLightbox('${escapeHtml(embed.image.url)}')" /></div>`
		: ''

	let footerHtml = ''
	if (embed.footer?.text || embed.timestamp) {
		const footerIcon = embed.footer?.icon_url
			? `<img class="chatlog__embed-footer-icon" src="${escapeHtml(embed.footer.icon_url)}" alt="" loading="lazy" />`
			: ''
		const footerText = embed.footer?.text ? escapeHtml(embed.footer.text) : ''
		const footerTime = embed.timestamp
			? new Date(embed.timestamp).toLocaleString()
			: ''
		const sep = footerText && footerTime ? ' • ' : ''
		footerHtml = `<div class="chatlog__embed-footer">${footerIcon}<span class="chatlog__embed-footer-text">${footerText}${sep}${footerTime}</span></div>`
	}

	return `<div class="chatlog__embed"><div class="chatlog__embed-color-pill" style="background-color: ${colorHex};"></div><div class="chatlog__embed-content-container"><div class="chatlog__embed-content"><div class="chatlog__embed-text">${authorHtml}${titleHtml}${descHtml}${fieldsHtml}${imageHtml}${footerHtml}</div>${thumbnailHtml}</div></div></div>`
}

function renderComponentEmoji(emoji?: DiscordComponentEmoji): string {
	if (!emoji) return ''
	if (emoji.id) {
		const ext = emoji.animated ? 'gif' : 'webp'
		const emojiUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=48&quality=lossless`
		return `<img class="chatlog__component-emoji" alt="${escapeHtml(emoji.name || '')}" src="${emojiUrl}" loading="lazy" />`
	}
	if (emoji.name) {
		return `<span class="chatlog__component-emoji-text">${escapeHtml(emoji.name)}</span>`
	}
	return ''
}

function renderComponentButton(comp: DiscordComponent): string {
	const styleNum = Number(comp.style) || 2
	const styleMap: Record<number, string> = {
		1: 'primary',
		2: 'secondary',
		3: 'success',
		4: 'danger',
		5: 'link',
		6: 'premium',
	}
	const styleClass = styleMap[styleNum] || 'secondary'
	const disabledClass = comp.disabled
		? ' chatlog__component-button--disabled'
		: ''
	const emojiHtml = renderComponentEmoji(comp.emoji)
	const labelHtml = comp.label
		? `<span class="chatlog__component-button-label">${escapeHtml(comp.label)}</span>`
		: ''

	if (comp.url) {
		return `<a href="${escapeHtml(comp.url)}" target="_blank" rel="noopener noreferrer" class="chatlog__component-button chatlog__component-button--link${disabledClass}">${emojiHtml}${labelHtml}<svg class="chatlog__component-button-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M10 5V3H5.00001C3.89544 3 3.00001 3.89543 3.00001 5V19C3.00001 20.1046 3.89544 21 5.00001 21H19C20.1046 21 21 20.1046 21 19V14H19V19H5.00001V5H10ZM14 3V5H17.5858L9.2929 13.2929L10.7071 14.7071L19 6.41421V10H21V3H14Z"/></svg></a>`
	}

	return `<button type="button" class="chatlog__component-button chatlog__component-button--${styleClass}${disabledClass}" ${comp.disabled ? 'disabled' : ''}>${emojiHtml}${labelHtml}</button>`
}

function renderComponentSelect(comp: DiscordComponent): string {
	const placeholder = comp.placeholder || 'Make a selection...'
	const disabledClass = comp.disabled
		? ' chatlog__component-select--disabled'
		: ''

	let optionsHtml = ''
	if (comp.options && comp.options.length > 0) {
		const optionItems = comp.options
			.map(opt => {
				if (!opt) return ''
				const emojiHtml = renderComponentEmoji(opt.emoji)
				const descHtml = opt.description
					? `<span class="chatlog__component-select-option-desc">${escapeHtml(opt.description)}</span>`
					: ''
				const selectedClass = opt.default ? ' selected' : ''
				const labelText = escapeHtml(opt.label || opt.value || 'Option')
				return `<div class="chatlog__component-select-option${selectedClass}">${emojiHtml}<div class="chatlog__component-select-option-text"><span class="chatlog__component-select-option-label">${labelText}</span>${descHtml}</div></div>`
			})
			.filter(Boolean)
			.join('')
		optionsHtml = `<div class="chatlog__component-select-menu">${optionItems}</div>`
	}

	return `<div class="chatlog__component-select${disabledClass}"><div class="chatlog__component-select-control"><span class="chatlog__component-select-placeholder">${escapeHtml(placeholder)}</span><svg class="chatlog__component-select-arrow" viewBox="0 0 24 24"><path fill="currentColor" d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg></div>${optionsHtml}</div>`
}

function renderComponentTextDisplay(
	comp: DiscordComponent,
	userMap: Map<string, string>,
	channelMap: Map<string, string>,
	roleMap?: Map<string, { name: string; color?: string }>,
	guildId?: string,
): string {
	if (!comp.content) return ''
	const parsed = parseMarkdown(
		comp.content,
		userMap,
		channelMap,
		roleMap,
		guildId,
	)
	return `<div class="chatlog__component-text-display">${parsed}</div>`
}

function renderComponentThumbnail(
	comp: DiscordComponent,
	attachments?: DiscordAttachment[],
): string {
	const rawMedia =
		comp.media?.url ||
		(typeof comp.media === 'string' ? comp.media : '') ||
		comp.url ||
		''
	const mediaUrl = resolveAttachmentUrl(rawMedia, attachments)
	if (!mediaUrl) return ''

	const desc = escapeHtml(comp.description || 'Thumbnail')
	const isSpoiler = Boolean(comp.spoiler)
	const hiddenClass = isSpoiler ? ' chatlog__attachment--hidden' : ''
	const spoilerCaption = isSpoiler
		? '<div class="chatlog__attachment-spoiler-caption">SPOILER</div>'
		: ''

	return `<div class="chatlog__component-thumbnail${hiddenClass}" ${isSpoiler ? 'onclick="showSpoiler(event, this)"' : ''}>${spoilerCaption}<img class="chatlog__component-thumbnail-img" src="${escapeHtml(mediaUrl)}" alt="${desc}" loading="lazy" onclick="openLightbox('${escapeHtml(mediaUrl)}')" /></div>`
}

function renderComponentMediaGallery(
	comp: DiscordComponent,
	attachments?: DiscordAttachment[],
): string {
	if (!comp.items || comp.items.length === 0) return ''

	const count = Math.min(comp.items.length, 4)
	const itemsHtml = comp.items
		.map(item => {
			if (!item) return ''
			const rawUrl =
				item.media?.url ||
				(typeof item.media === 'string' ? item.media : '') ||
				item.url ||
				''
			const itemUrl = resolveAttachmentUrl(rawUrl, attachments)
			if (!itemUrl) return ''
			const isSpoiler = Boolean(item.spoiler)
			const hiddenClass = isSpoiler ? ' chatlog__attachment--hidden' : ''
			const spoilerCaption = isSpoiler
				? '<div class="chatlog__attachment-spoiler-caption">SPOILER</div>'
				: ''
			const desc = escapeHtml(item.description || 'Media item')
			return `<div class="chatlog__component-media-item${hiddenClass}" ${isSpoiler ? 'onclick="showSpoiler(event, this)"' : ''}>${spoilerCaption}<img class="chatlog__component-media-img" src="${escapeHtml(itemUrl)}" alt="${desc}" loading="lazy" onclick="openLightbox('${escapeHtml(itemUrl)}')" /></div>`
		})
		.filter(Boolean)
		.join('')

	if (!itemsHtml) return ''
	return `<div class="chatlog__component-media-gallery chatlog__component-media-gallery--${count}">${itemsHtml}</div>`
}

function renderComponentFile(
	comp: DiscordComponent,
	attachments?: DiscordAttachment[],
): string {
	let rawUrl = comp.file?.url || comp.url || ''
	let filename = comp.filename || comp.file?.filename || ''
	let size = comp.size || comp.file?.size

	if (rawUrl.startsWith('attachment://')) {
		const attName = rawUrl.slice('attachment://'.length)
		const att = attachments?.find(a => a.filename === attName)
		if (att) {
			rawUrl = att.proxy_url || att.url
			if (!filename) filename = att.filename
			if (!size) size = att.size
		}
	}

	const url = escapeHtml(rawUrl || '#')
	const safeFilename = escapeHtml(filename || 'File Attachment')
	const sizeStr = formatFileSize(size)

	return `<div class="chatlog__attachment-generic chatlog__component-file"><svg class="chatlog__attachment-generic-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg><div class="chatlog__attachment-generic-details"><a class="chatlog__attachment-generic-name" href="${url}" target="_blank" rel="noopener noreferrer">${safeFilename}</a>${sizeStr ? `<span class="chatlog__attachment-generic-size">${sizeStr}</span>` : ''}</div></div>`
}

function renderComponentSeparator(comp: DiscordComponent): string {
	const isDivider = Boolean(comp.divider)
	const spacing = Number(comp.spacing) || 1
	const dividerClass = isDivider ? ' chatlog__component-separator--divider' : ''
	return `<div class="chatlog__component-separator${dividerClass} chatlog__component-separator--spacing-${spacing}"></div>`
}

function renderComponentSection(
	comp: DiscordComponent,
	userMap: Map<string, string>,
	channelMap: Map<string, string>,
	depth: number,
	attachments?: DiscordAttachment[],
	roleMap?: Map<string, { name: string; color?: string }>,
	guildId?: string,
): string {
	const childrenHtml = (comp.components || [])
		.map(c =>
			renderSingleComponent(
				c,
				userMap,
				channelMap,
				depth + 1,
				attachments,
				roleMap,
				guildId,
			),
		)
		.join('')
	const accessoryHtml = comp.accessory
		? renderSingleComponent(
				comp.accessory,
				userMap,
				channelMap,
				depth + 1,
				attachments,
				roleMap,
				guildId,
			)
		: ''

	return `<div class="chatlog__component-section"><div class="chatlog__component-section-content">${childrenHtml}</div>${accessoryHtml ? `<div class="chatlog__component-section-accessory">${accessoryHtml}</div>` : ''}</div>`
}

function renderComponentContainer(
	comp: DiscordComponent,
	userMap: Map<string, string>,
	channelMap: Map<string, string>,
	depth: number,
	attachments?: DiscordAttachment[],
	roleMap?: Map<string, { name: string; color?: string }>,
	guildId?: string,
): string {
	const colorHex = comp.accent_color
		? `#${comp.accent_color.toString(16).padStart(6, '0')}`
		: ''
	const accentStyle = colorHex ? `border-left-color: ${colorHex};` : ''
	const isSpoiler = Boolean(comp.spoiler)
	const spoilerClass = isSpoiler
		? ' chatlog__component-container--spoiler chatlog__markdown-spoiler--hidden'
		: ''
	const childrenHtml = (comp.components || [])
		.map(c =>
			renderSingleComponent(
				c,
				userMap,
				channelMap,
				depth + 1,
				attachments,
				roleMap,
				guildId,
			),
		)
		.join('')

	return `<div class="chatlog__component-container${spoilerClass}" style="${accentStyle}" ${isSpoiler ? 'onclick="showSpoiler(event, this)"' : ''}><div class="chatlog__component-container-inner">${childrenHtml}</div></div>`
}

function renderComponentActionRow(
	comp: DiscordComponent,
	userMap: Map<string, string>,
	channelMap: Map<string, string>,
	depth: number,
	attachments?: DiscordAttachment[],
	roleMap?: Map<string, { name: string; color?: string }>,
	guildId?: string,
): string {
	const childrenHtml = (comp.components || [])
		.map(c =>
			renderSingleComponent(
				c,
				userMap,
				channelMap,
				depth + 1,
				attachments,
				roleMap,
				guildId,
			),
		)
		.join('')
	return `<div class="chatlog__component-action-row">${childrenHtml}</div>`
}

function renderSingleComponent(
	comp: DiscordComponent,
	userMap: Map<string, string>,
	channelMap: Map<string, string>,
	depth = 0,
	attachments?: DiscordAttachment[],
	roleMap?: Map<string, { name: string; color?: string }>,
	guildId?: string,
): string {
	if (!comp || depth > 10) return ''
	try {
		const typeNum = Number(comp.type)
		const typeStr = String(comp.type).toLowerCase()

		if (typeNum === 1 || typeStr === 'action_row') {
			return renderComponentActionRow(
				comp,
				userMap,
				channelMap,
				depth,
				attachments,
				roleMap,
				guildId,
			)
		}
		if (typeNum === 2 || typeStr === 'button') {
			return renderComponentButton(comp)
		}
		if (
			typeNum === 3 ||
			typeNum === 5 ||
			typeNum === 6 ||
			typeNum === 7 ||
			typeNum === 8 ||
			typeStr.includes('select')
		) {
			return renderComponentSelect(comp)
		}
		if (typeNum === 9 || typeStr === 'section') {
			return renderComponentSection(
				comp,
				userMap,
				channelMap,
				depth,
				attachments,
				roleMap,
				guildId,
			)
		}
		if (typeNum === 10 || typeStr === 'text_display') {
			return renderComponentTextDisplay(
				comp,
				userMap,
				channelMap,
				roleMap,
				guildId,
			)
		}
		if (typeNum === 11 || typeStr === 'thumbnail') {
			return renderComponentThumbnail(comp, attachments)
		}
		if (typeNum === 12 || typeStr === 'media_gallery') {
			return renderComponentMediaGallery(comp, attachments)
		}
		if (typeNum === 13 || typeStr === 'file') {
			return renderComponentFile(comp, attachments)
		}
		if (typeNum === 14 || typeStr === 'separator') {
			return renderComponentSeparator(comp)
		}
		if (typeNum === 17 || typeStr === 'container') {
			return renderComponentContainer(
				comp,
				userMap,
				channelMap,
				depth,
				attachments,
				roleMap,
				guildId,
			)
		}

		return ''
	} catch {
		return ''
	}
}

function renderComponents(
	components: DiscordComponent[],
	userMap: Map<string, string>,
	channelMap: Map<string, string>,
	roleMap?: Map<string, { name: string; color?: string }>,
	guildId?: string,
	attachments?: DiscordAttachment[],
): string {
	if (!components || components.length === 0) return ''
	const rendered = components
		.map(c =>
			renderSingleComponent(
				c,
				userMap,
				channelMap,
				0,
				attachments,
				roleMap,
				guildId,
			),
		)
		.filter(Boolean)
		.join('')
	if (!rendered) return ''
	return `<div class="chatlog__components">${rendered}</div>`
}

function renderPoll(poll?: DiscordPoll): string {
	if (!poll?.question) return ''
	try {
		const questionText = escapeHtml(poll.question.text || 'Poll')
		const answers = poll.answers || []
		const answerCounts = poll.results?.answer_counts || []
		const totalVotes =
			poll.results?.total_votes ??
			answerCounts.reduce((acc, cur) => acc + (cur.count || 0), 0)

		const answersHtml = answers
			.map(ans => {
				const count = answerCounts.find(c => c.id === ans.answer_id)?.count ?? 0
				const percent =
					totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
				let emojiHtml = ''
				if (ans.poll_media?.emoji) {
					const em = ans.poll_media.emoji
					if (em.id) {
						const ext = em.animated ? 'gif' : 'webp'
						emojiHtml = `<img class="chatlog__emoji chatlog__emoji--small" alt="${escapeHtml(em.name)}" src="https://cdn.discordapp.com/emojis/${em.id}.${ext}?size=48&quality=lossless" loading="lazy" />`
					} else if (em.name) {
						emojiHtml = `<span class="chatlog__emoji">${escapeHtml(em.name)}</span>`
					}
				}
				const ansText = escapeHtml(ans.poll_media?.text || '')
				return `<div class="chatlog__poll-answer"><div class="chatlog__poll-answer-fill" style="width: ${percent}%;"></div><div class="chatlog__poll-answer-content"><span class="chatlog__poll-answer-text">${emojiHtml}<span>${ansText}</span></span><span class="chatlog__poll-answer-votes">${count} (${percent}%)</span></div></div>`
			})
			.join('')

		const isFinal = Boolean(poll.results?.is_finalized)
		const footerStatus = isFinal
			? '<span class="chatlog__poll-status">Final Results</span>'
			: ''
		const totalText = `${totalVotes} vote${totalVotes === 1 ? '' : 's'}`

		return `<div class="chatlog__poll"><div class="chatlog__poll-question">${questionText}</div><div class="chatlog__poll-answers">${answersHtml}</div><div class="chatlog__poll-footer"><span class="chatlog__poll-total">${totalText}</span>${footerStatus}</div></div>`
	} catch {
		return ''
	}
}

function getSystemMessageInfo(msg: DiscordMessage): {
	icon: string
	text: string
} | null {
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

	if (typeNum === 6) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M16 12V4H17V2H7V4H8V12L6 14V16H11V22H13V16H18V14L16 12Z"/></svg>',
			text: 'pinned a message to this channel.',
		}
	}
	if (typeNum === 7 || typeNum === 1) {
		let text = 'joined the server.'
		if (typeNum === 1) {
			const recipient = msg.mentions?.[0]
			const recipientName = recipient
				? recipient.globalName || recipient.global_name || recipient.username
				: ''
			text = recipientName
				? `added ${escapeHtml(recipientName)} to the group.`
				: 'added a recipient to the group.'
		}
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M10 5.414 8.586 4 0.586 12l8 8 1.414-1.414L3.414 13H24v-2H3.414l6.586-6.586Z"/></svg>',
			text,
		}
	}
	if (typeNum === 2) {
		const recipient = msg.mentions?.[0]
		const recipientName = recipient
			? recipient.globalName || recipient.global_name || recipient.username
			: ''
		const text = recipientName
			? `removed ${escapeHtml(recipientName)} from the group.`
			: 'removed a recipient from the group.'
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="m14 5.414 1.414-1.414 8 8-8 8-1.414-1.414L20.586 13H0v-2h20.586L14 5.414Z"/></svg>',
			text,
		}
	}
	if (typeNum >= 8 && typeNum <= 11) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2L2 9.19V14.81L12 22L22 14.81V9.19L12 2ZM12 4.31L19.46 9.69L12 15.07L4.54 9.69L12 4.31Z"/></svg>',
			text:
				typeNum === 8
					? 'boosted the server!'
					: `boosted the server to Tier ${typeNum - 7}!`,
		}
	}
	if (typeNum === 18) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6l-4 4V6a2 2 0 0 1 2-2Z"/></svg>',
			text: msg.content
				? `started a thread: ${escapeHtml(msg.content)}`
				: 'started a thread.',
		}
	}
	if (typeNum === 21) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6l-4 4V6a2 2 0 0 1 2-2Z"/></svg>',
			text: 'started a thread starter message.',
		}
	}
	if (typeNum === 4) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/></svg>',
			text: msg.content
				? `changed the channel name: ${escapeHtml(msg.content)}`
				: 'changed the channel name.',
		}
	}
	if (typeNum === 5) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
			text: 'changed the channel icon.',
		}
	}
	if (typeNum === 3) {
		const mins = msg.call?.duration
			? Math.max(1, Math.round(msg.call.duration / 60))
			: 0
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 2 3 2.24 3 2.99 3 13.28 10.73 21 21.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>',
			text:
				mins > 0
					? `started a call that lasted ${mins} min.`
					: 'started a call.',
		}
	}
	if (typeNum === 12) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>',
			text: 'added a channel follow to this channel.',
		}
	}
	if (typeNum === 22) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
			text: 'reminded the server about guild invites.',
		}
	}
	if (typeNum === 24) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>',
			text: 'AutoMod caught a message.',
		}
	}
	if (typeNum === 25) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="m12 17.27 6.18 3.73-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
			text: 'subscribed to the server.',
		}
	}
	if (typeNum === 27) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm7 12H5v-2.14c0-1.89 3.56-2.86 7-2.86s7 .97 7 2.86V19z"/></svg>',
			text: 'started a stage.',
		}
	}
	if (typeNum === 28) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm7 12H5v-2.14c0-1.89 3.56-2.86 7-2.86s7 .97 7 2.86V19z"/></svg>',
			text: 'ended a stage.',
		}
	}
	if (typeNum === 29) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm7 12H5v-2.14c0-1.89 3.56-2.86 7-2.86s7 .97 7 2.86V19z"/></svg>',
			text: 'became a speaker in the stage.',
		}
	}
	if (typeNum === 31) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm7 12H5v-2.14c0-1.89 3.56-2.86 7-2.86s7 .97 7 2.86V19z"/></svg>',
			text: msg.content
				? `changed the stage topic: ${escapeHtml(msg.content)}`
				: 'changed the stage topic.',
		}
	}
	if (typeNum === 32) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
			text: 'added an integration to this channel.',
		}
	}
	if (typeNum === 36 || typeNum === 44) {
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z"/></svg>',
			text: 'purchased an item from the server shop.',
		}
	}
	if (typeNum === 46) {
		const details = parsePollResultDetails(msg)
		let text = 'A poll has ended.'
		if (details) {
			let emojiHtml = ''
			if (details.emojiId) {
				const ext = details.emojiAnimated ? 'gif' : 'webp'
				emojiHtml = `<img class="chatlog__emoji chatlog__emoji--small" alt="${escapeHtml(details.emojiName || '')}" src="https://cdn.discordapp.com/emojis/${details.emojiId}.${ext}?size=48&quality=lossless" loading="lazy" /> `
			} else if (details.emojiName) {
				emojiHtml = `<span class="chatlog__emoji">${escapeHtml(details.emojiName)}</span> `
			}
			const votesStr = details.totalVotes
				? `(${details.victorVotes}/${details.totalVotes} votes)`
				: `(${details.victorVotes} votes)`
			text = `A poll closed with ${emojiHtml}<strong>${escapeHtml(details.victorText)}</strong> winning: "${escapeHtml(details.question)}" ${votesStr}`
		}
		return {
			icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M4 19h4v-7H4v7zm6 0h4v-11h-4v11zm6 0h4V3h-4v16z"/></svg>',
			text,
		}
	}

	return {
		icon: '<svg class="chatlog__system-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
		text: 'system action performed.',
	}
}

function renderStickerHtml(s: DiscordStickerItem): string {
	const name = s.name || 'Sticker'
	const escapedName = escapeHtml(name)
	const formatType = s.format_type ?? s.formatType ?? 1
	if (formatType === 3) {
		return `<div class="chatlog__sticker" title="${escapedName}"><lottie-player src="https://cdn.discordapp.com/stickers/${s.id}.json" autoplay loop mode="normal"></lottie-player><noscript><img class="chatlog__sticker--media" src="https://cdn.discordapp.com/stickers/${s.id}.png?size=160" alt="${escapedName}" loading="lazy" /></noscript></div>`
	}
	const ext = formatType === 4 ? 'gif' : 'png'
	return `<div class="chatlog__sticker" title="${escapedName}"><img class="chatlog__sticker--media" src="https://cdn.discordapp.com/stickers/${s.id}.${ext}?size=160" alt="${escapedName}" loading="lazy" /></div>`
}

function renderForwardedMessages(
	snapshots: DiscordMessageSnapshot[] | undefined,
	userMap: Map<string, string>,
	channelMap: Map<string, string>,
	roleMap?: Map<string, { name: string; color?: string }>,
	guildId?: string,
	depth = 0,
): string {
	if (!snapshots || snapshots.length === 0 || depth > 5) return ''
	try {
		const itemsHtml = snapshots
			.map(snap => {
				const msg = (snap?.message ?? snap) as DiscordMessage
				if (!msg) return ''

				let authorHeaderHtml = ''
				const hasRealAuthor = Boolean(
					msg.author &&
						((msg.author.username &&
							msg.author.username !== 'Unknown' &&
							msg.author.id !== '0') ||
							msg.author.globalName ||
							msg.nick),
				)
				const msgTime = msg.timestamp ? new Date(msg.timestamp).getTime() : 0
				const formattedDate = msgTime ? new Date(msgTime).toLocaleString() : ''

				if (hasRealAuthor && msg.author) {
					const author = msg.author
					const displayName = escapeHtml(
						msg.nick || author.globalName || author.username || 'User',
					)
					const username = escapeHtml(author.username || '')
					const hasHandle =
						(author.globalName || msg.nick) &&
						author.globalName !== author.username &&
						msg.nick !== author.username
					const authorColor = msg.colorString
						? `color: ${msg.colorString};`
						: ''
					const avatarUrl = getAvatarUrl(author, 0)
					const botBadge = author.bot
						? '<span class="chatlog__author-tag">BOT</span>'
						: ''
					const systemBadge = author.system
						? '<span class="chatlog__author-tag system">SYSTEM</span>'
						: ''
					authorHeaderHtml = `<div class="chatlog__forward-author-header"><img class="chatlog__forward-avatar" src="${avatarUrl}" alt="${displayName}" loading="lazy" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"/><span class="chatlog__forward-author-name" style="${authorColor}">${displayName}</span>${hasHandle ? `<span class="chatlog__forward-author-handle">@${username}</span>` : ''}${botBadge}${systemBadge}${formattedDate ? `<span class="chatlog__forward-timestamp" title="${formattedDate}">${formattedDate}</span>` : ''}</div>`
				} else if (formattedDate) {
					authorHeaderHtml = `<div class="chatlog__forward-author-header"><span class="chatlog__forward-timestamp" title="${formattedDate}">${formattedDate}</span></div>`
				}

				const snapEdited = msg.editedTimestamp ?? msg.edited_timestamp
				const snapEditedBadge = snapEdited
					? `<span class="chatlog__edited-timestamp" title="${new Date(snapEdited).toLocaleString()}">(edited)</span>`
					: ''

				const parsedContent = msg.content
					? parseMarkdown(msg.content, userMap, channelMap, roleMap, guildId)
					: ''

				let attachmentsHtml = ''
				if (msg.attachments && msg.attachments.length > 0) {
					attachmentsHtml = renderAttachments(msg.attachments, msg.flags)
				}

				let embedsHtml = ''
				const suppressEmbeds = Boolean(msg.flags && (msg.flags & 4) !== 0)
				if (!suppressEmbeds && msg.embeds && msg.embeds.length > 0) {
					embedsHtml = `<div class="chatlog__embeds">${msg.embeds.map(e => renderEmbed(e, userMap, channelMap, roleMap, guildId)).join('')}</div>`
				}

				let componentsHtml = ''
				if (msg.components && msg.components.length > 0) {
					componentsHtml = renderComponents(
						msg.components,
						userMap,
						channelMap,
						roleMap,
						guildId,
						msg.attachments,
					)
				}

				const pollHtml = renderPoll(msg.poll)

				let stickersHtml = ''
				const snapStickers =
					msg.stickerItems || msg.stickers || msg.sticker_items
				if (Array.isArray(snapStickers) && snapStickers.length > 0) {
					const stickerItems = snapStickers
						.map(s => renderStickerHtml(s))
						.join('')
					stickersHtml = `<div class="chatlog__stickers">${stickerItems}</div>`
				}

				const nestedSnapshots = msg.messageSnapshots || msg.message_snapshots
				let nestedForwardHtml = ''
				if (Array.isArray(nestedSnapshots) && nestedSnapshots.length > 0) {
					nestedForwardHtml = renderForwardedMessages(
						nestedSnapshots,
						userMap,
						channelMap,
						roleMap,
						guildId,
						depth + 1,
					)
				}

				return `<div class="chatlog__forward-card">${authorHeaderHtml}${parsedContent ? `<div class="chatlog__forward-content chatlog__content">${parsedContent}${snapEditedBadge}</div>` : ''}${attachmentsHtml}${embedsHtml}${componentsHtml}${pollHtml}${stickersHtml}${nestedForwardHtml}</div>`
			})
			.filter(Boolean)
			.join('')

		if (!itemsHtml) return ''

		const forwardHeader = `<div class="chatlog__forward-header"><svg class="chatlog__forward-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12.2929 4.29289C12.6834 3.90237 13.3166 3.90237 13.7071 4.29289L20.7071 11.2929C21.0976 11.6834 21.0976 12.3166 20.7071 12.7071L13.7071 19.7071C13.3166 20.0976 12.6834 20.0976 12.2929 19.7071C11.9024 19.3166 11.9024 18.6834 12.2929 18.2929L17.5858 13H5C3.34315 13 2 11.6569 2 10C2 8.34315 3.34315 7 5 7H7C7.55228 7 8 7.44772 8 8C8 8.55228 7.55228 9 7 9H5C4.44772 9 4 9.44772 4 10C4 10.5523 4.44772 11 5 11H17.5858L12.2929 5.70711C11.9024 5.31658 11.9024 4.68342 12.2929 4.29289Z"/></svg><span class="chatlog__forward-label">Forwarded</span></div>`

		return `<div class="chatlog__forward-container">${forwardHeader}${itemsHtml}</div>`
	} catch {
		return ''
	}
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

export function generateDiscordChatHtml(
	meta: ChannelExportMetadata,
	messages: DiscordMessage[],
	settings: Settings,
): string {
	const channelName = escapeHtml(meta.name)
	const guildName = meta.guildName
		? escapeHtml(meta.guildName)
		: 'Direct Message'
	const topic = meta.topic ? escapeHtml(meta.topic) : ''
	const exportTime = new Date().toLocaleString()

	const userMap = new Map<string, string>()
	const channelMap = new Map<string, string>()
	const roleMap = new Map<string, { name: string; color?: string }>()
	const messageMap = new Map<string, DiscordMessage>()

	const rootGuildId = meta.id
		? (
				Stores.ChannelStore as unknown as ChannelStoreInstance | undefined
			)?.getChannel?.(meta.id)?.guild_id
		: undefined

	if (meta.id) {
		channelMap.set(meta.id, meta.name)
	}

	for (const m of messages) {
		if (m.id) {
			messageMap.set(m.id, m)
		}
		if (m.author?.id) {
			userMap.set(
				m.author.id,
				m.nick || m.author.globalName || m.author.username || 'User',
			)
		}
		const snaps = m.messageSnapshots || m.message_snapshots
		if (Array.isArray(snaps)) {
			for (const s of snaps) {
				const sAuthor = s?.message?.author
				if (sAuthor?.id) {
					userMap.set(
						sAuthor.id,
						sAuthor.globalName || sAuthor.username || 'User',
					)
				}
			}
		}
	}

	let groupsHtml = ''
	let currentGroupMessages: DiscordMessage[] = []
	let currentGroupAuthorId = ''
	let currentGroupTimestamp = 0

	const flushGroup = () => {
		if (currentGroupMessages.length === 0) return

		let groupInner = ''
		for (let i = 0; i < currentGroupMessages.length; i++) {
			const msg = currentGroupMessages[i]
			const isFirstInGroup = i === 0
			const author = msg.author ?? { id: '0', username: 'Unknown' }
			const displayName = escapeHtml(
				msg.nick || author.globalName || author.username || 'Unknown',
			)
			const username = escapeHtml(author.username || '')
			const hasHandle =
				(author.globalName || msg.nick) &&
				author.globalName !== author.username &&
				msg.nick !== author.username

			const authorColor = msg.colorString ? `color: ${msg.colorString};` : ''

			const msgTime = msg.timestamp ? new Date(msg.timestamp).getTime() : 0
			const formattedDate = msgTime ? new Date(msgTime).toLocaleString() : ''
			const shortTime = msgTime
				? new Date(msgTime).toLocaleTimeString([], {
						hour: '2-digit',
						minute: '2-digit',
					})
				: ''

			const sysInfo = getSystemMessageInfo(msg)
			if (sysInfo) {
				groupInner += `<div id="chatlog__message-container-${msg.id}" class="chatlog__message-container chatlog__message-container--system" data-message-id="${msg.id}"><div class="chatlog__message chatlog__message--system"><div class="chatlog__message-aside">${sysInfo.icon}</div><div class="chatlog__message-primary"><span class="chatlog__system-content"><span class="chatlog__author" style="${authorColor}">${displayName}</span> <span class="chatlog__system-text">${sysInfo.text}</span></span>${settings.includeTimestamps && formattedDate ? `<span class="chatlog__timestamp" title="${formattedDate}">${shortTime || formattedDate}</span>` : ''}</div></div></div>`
				continue
			}

			const msgGuildId = msg.channel_id
				? ((
						Stores.ChannelStore as unknown as ChannelStoreInstance | undefined
					)?.getChannel?.(msg.channel_id)?.guild_id ?? rootGuildId)
				: rootGuildId

			const parsedContent = parseMarkdown(
				msg.content ?? '',
				userMap,
				channelMap,
				roleMap,
				msgGuildId,
			)

			const rawEdited = msg.editedTimestamp ?? msg.edited_timestamp
			const editedTime = rawEdited ? new Date(rawEdited).getTime() : 0
			const formattedEditedDate = editedTime
				? new Date(editedTime).toLocaleString()
				: ''
			const isEdited = Boolean(
				editedTime || (typeof msg.isEdited === 'function' && msg.isEdited()),
			)
			const editedBadge = isEdited
				? `<span class="chatlog__edited-timestamp" title="${formattedEditedDate || 'Edited'}">(edited)</span>`
				: ''

			const pollHtml = renderPoll(msg.poll)
			const forwardedHtml = renderForwardedMessages(
				msg.messageSnapshots || msg.message_snapshots,
				userMap,
				channelMap,
				roleMap,
				msgGuildId,
				0,
			)

			let attachmentsHtml = ''
			if (
				settings.includeAttachments &&
				msg.attachments &&
				msg.attachments.length > 0
			) {
				attachmentsHtml = renderAttachments(msg.attachments, msg.flags)
			}

			let embedsHtml = ''
			const suppressEmbeds = Boolean(msg.flags && (msg.flags & 4) !== 0)
			if (
				settings.includeEmbeds &&
				!suppressEmbeds &&
				msg.embeds &&
				msg.embeds.length > 0
			) {
				embedsHtml = `<div class="chatlog__embeds">${msg.embeds.map(e => renderEmbed(e, userMap, channelMap, roleMap, msgGuildId)).join('')}</div>`
			}

			let componentsHtml = ''
			if (
				(settings.includeComponents ?? true) &&
				msg.components &&
				msg.components.length > 0
			) {
				componentsHtml = renderComponents(
					msg.components,
					userMap,
					channelMap,
					roleMap,
					msgGuildId,
					msg.attachments,
				)
			}

			let reactionsHtml = ''
			const visibleReactions = filterRealReactions(msg)
			if (visibleReactions.length > 0) {
				const reactionItems = visibleReactions
					.map(r => {
						const emoji = r.emoji
						const count = r.count
						if (emoji.id) {
							const ext = emoji.animated ? 'gif' : 'webp'
							const emojiUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=48&quality=lossless`
							return `<div class="chatlog__reaction" title="${escapeHtml(emoji.name)}"><img class="chatlog__emoji chatlog__emoji--small" alt="${escapeHtml(emoji.name)}" src="${emojiUrl}" loading="lazy" /><span class="chatlog__reaction-count">${count}</span></div>`
						}
						return `<div class="chatlog__reaction" title="${escapeHtml(emoji.name)}"><span class="chatlog__reaction-emoji">${escapeHtml(emoji.name)}</span><span class="chatlog__reaction-count">${count}</span></div>`
					})
					.join('')
				reactionsHtml = `<div class="chatlog__reactions">${reactionItems}</div>`
			}

			let stickersHtml = ''
			const allStickers = msg.stickerItems || msg.stickers || msg.sticker_items
			if (Array.isArray(allStickers) && allStickers.length > 0) {
				const stickerItems = allStickers.map(s => renderStickerHtml(s)).join('')
				stickersHtml = `<div class="chatlog__stickers">${stickerItems}</div>`
			}

			const isForwardMessage = Boolean(
				(msg.messageSnapshots && msg.messageSnapshots.length > 0) ||
					(msg.message_snapshots && msg.message_snapshots.length > 0) ||
					msg.messageReference?.type === 1,
			)

			const interaction = msg.interactionMetadata || msg.interaction
			let interactionHtml = ''
			if (interaction) {
				const interUser: DiscordAuthor = interaction.user ||
					interaction.author || { id: '0', username: 'User' }
				const interName = escapeHtml(
					interUser.globalName || interUser.username || 'User',
				)
				const cmdName = escapeHtml(interaction.name || 'command')
				const interAvatar = getAvatarUrl(interUser, 0)
				interactionHtml = `<div class="chatlog__interaction"><img class="chatlog__interaction-avatar" src="${interAvatar}" alt="" loading="lazy" /><span class="chatlog__interaction-author">${interName}</span> <span class="chatlog__interaction-text">used</span> <span class="chatlog__interaction-command">/${cmdName}</span></div>`
			}

			let replyHtml = ''
			const refId =
				msg.referencedMessage?.id ?? msg.messageReference?.message_id
			if (refId && !isForwardMessage) {
				const refMsg = msg.referencedMessage ?? messageMap.get(refId)
				if (refMsg) {
					const refAuthor = escapeHtml(
						refMsg.nick ||
							refMsg.author?.globalName ||
							refMsg.author?.username ||
							'User',
					)
					const refAuthorColor = refMsg.colorString
						? `color: ${refMsg.colorString};`
						: ''
					const refAvatar = getAvatarUrl(refMsg.author, 0)
					const refSnippet = refMsg.content
						? escapeHtml(
								refMsg.content.length > 70
									? `${refMsg.content.slice(0, 70)}...`
									: refMsg.content,
							)
						: refMsg.attachments?.length
							? 'Click to see attachment'
							: 'Message'

					replyHtml = `<div class="chatlog__reply"><div class="chatlog__reply-symbol"></div><img class="chatlog__reply-avatar" src="${refAvatar}" alt="" loading="lazy" /><span class="chatlog__reply-author" style="${refAuthorColor}">${refAuthor}</span><a class="chatlog__reply-content chatlog__reply-link" onclick="scrollToMessage(event, '${refId}')">${refSnippet}</a></div>`
				} else {
					replyHtml = `<div class="chatlog__reply"><div class="chatlog__reply-symbol"></div><a class="chatlog__reply-content chatlog__reply-link" onclick="scrollToMessage(event, '${refId}')">Original message was deleted or not loaded.</a></div>`
				}
			}

			if (isFirstInGroup) {
				const avatarUrl = getAvatarUrl(author, 0)
				const botBadge = author.bot
					? '<span class="chatlog__author-tag">BOT</span>'
					: ''
				const systemBadge = author.system
					? '<span class="chatlog__author-tag system">SYSTEM</span>'
					: ''
				const pinnedBadge = msg.pinned
					? '<span class="chatlog__pinned-badge" title="Pinned message"><svg class="chatlog__pinned-icon" viewBox="0 0 24 24"><path fill="currentColor" d="m16 12 2 2v2h-5v6l-1 1-1-1v-6H6v-2l2-2V5H7V3h10v2h-1v7Z"/></svg></span>'
					: ''

				groupInner += `<div id="chatlog__message-container-${msg.id}" class="chatlog__message-container ${msg.pinned ? 'chatlog__message-container--pinned' : ''}" data-message-id="${msg.id}"><div class="chatlog__message"><div class="chatlog__message-aside"><img class="chatlog__avatar" src="${avatarUrl}" alt="${displayName}" loading="lazy" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"/></div><div class="chatlog__message-primary">${interactionHtml}${replyHtml}<div class="chatlog__header"><span class="chatlog__author" style="${authorColor}">${displayName}</span>${hasHandle ? `<span class="chatlog__author-handle">@${username}</span>` : ''}${botBadge}${systemBadge}${pinnedBadge}${settings.includeTimestamps && formattedDate ? `<span class="chatlog__timestamp" title="${formattedDate}">${formattedDate}</span>` : ''}</div><div class="chatlog__content">${parsedContent}${editedBadge}</div>${pollHtml}${forwardedHtml}${attachmentsHtml}${embedsHtml}${componentsHtml}${stickersHtml}${reactionsHtml}</div></div></div>`
			} else {
				groupInner += `<div id="chatlog__message-container-${msg.id}" class="chatlog__message-container ${msg.pinned ? 'chatlog__message-container--pinned' : ''}" data-message-id="${msg.id}"><div class="chatlog__message chatlog__message--coalesced"><div class="chatlog__message-aside"><span class="chatlog__short-timestamp" title="${formattedDate}">${shortTime}</span></div><div class="chatlog__message-primary">${interactionHtml}${replyHtml}<div class="chatlog__content">${parsedContent}${editedBadge}</div>${pollHtml}${forwardedHtml}${attachmentsHtml}${embedsHtml}${componentsHtml}${stickersHtml}${reactionsHtml}</div></div></div>`
			}
		}

		groupsHtml += `<div class="chatlog__message-group">${groupInner}</div>`
		currentGroupMessages = []
	}

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]
		const authorId = msg.author?.id ?? '0'
		const msgTime = msg.timestamp ? new Date(msg.timestamp).getTime() : 0
		const isForward = Boolean(
			(msg.messageSnapshots && msg.messageSnapshots.length > 0) ||
				(msg.message_snapshots && msg.message_snapshots.length > 0) ||
				msg.messageReference?.type === 1,
		)
		const hasReply = Boolean(
			(msg.referencedMessage || msg.messageReference?.message_id) && !isForward,
		)
		const hasInteraction = Boolean(msg.interactionMetadata || msg.interaction)
		const isSystem = getSystemMessageInfo(msg) !== null

		const shouldCoalesce =
			!isSystem &&
			!hasReply &&
			!isForward &&
			!hasInteraction &&
			currentGroupMessages.length > 0 &&
			currentGroupAuthorId === authorId &&
			msgTime > 0 &&
			currentGroupTimestamp > 0 &&
			msgTime - currentGroupTimestamp < 5 * 60 * 1000

		if (shouldCoalesce) {
			currentGroupMessages.push(msg)
			currentGroupTimestamp = msgTime
		} else {
			flushGroup()
			currentGroupMessages.push(msg)
			currentGroupAuthorId = isSystem ? '' : authorId
			currentGroupTimestamp = msgTime
			if (isSystem) {
				flushGroup()
			}
		}
	}
	flushGroup()

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${guildName} - #${channelName}</title>
	<style>
		:root {
			--bg-primary: #313338;
			--bg-secondary: #2b2d31;
			--bg-tertiary: #1e1f22;
			--bg-hover: #2e3035;
			--text-normal: #dbdee1;
			--text-muted: #949ba4;
			--text-header: #f2f3f5;
			--brand-color: #5865f2;
			--brand-hover: #4752c4;
			--border-subtle: #3f4147;
			--mention-bg: rgba(88, 101, 242, 0.3);
			--mention-text: #dee0fc;
			--font-main: "gg sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
			--font-code: Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Courier New", Courier, monospace;
		}

		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}

		html, body {
			background-color: var(--bg-primary);
			color: var(--text-normal);
			font-family: var(--font-main);
			font-size: 16px;
			line-height: 1.375;
			scroll-behavior: smooth;
		}

		a {
			color: #00a8fc;
			text-decoration: none;
		}

		a:hover {
			text-decoration: underline;
		}

				header {
			position: sticky;
			top: 0;
			z-index: 100;
			background-color: var(--bg-secondary);
			border-bottom: 1px solid var(--border-subtle);
			padding: 8px 16px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
			height: 48px;
		}

		.header-left {
			display: flex;
			align-items: center;
			gap: 8px;
			min-width: 0;
			flex: 1;
		}

		.channel-hash {
			color: var(--text-muted);
			font-size: 20px;
			font-weight: 600;
			flex-shrink: 0;
		}

		.channel-title-wrap {
			display: flex;
			align-items: baseline;
			gap: 8px;
			overflow: hidden;
			white-space: nowrap;
		}

		.channel-name {
			color: var(--text-header);
			font-size: 16px;
			font-weight: 700;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.guild-name {
			color: var(--text-muted);
			font-size: 12px;
			font-weight: 500;
			flex-shrink: 0;
		}

		.topic-toggle-btn {
			background: transparent;
			border: 1px solid var(--border-subtle);
			color: var(--text-muted);
			font-size: 11px;
			font-weight: 600;
			padding: 2px 8px;
			border-radius: 4px;
			cursor: pointer;
			flex-shrink: 0;
			transition: background-color 0.15s, color 0.15s;
		}

		.topic-toggle-btn:hover {
			color: var(--text-normal);
			background-color: var(--bg-tertiary);
		}

		.header-right {
			display: flex;
			align-items: center;
			gap: 10px;
			flex-shrink: 0;
		}

		.search-box {
			display: flex;
			align-items: center;
			background-color: var(--bg-tertiary);
			border-radius: 4px;
			padding: 4px 8px;
			border: 1px solid transparent;
			transition: border-color 0.2s;
		}

		.search-box:focus-within {
			border-color: var(--brand-color);
		}

		.search-box input {
			background: transparent;
			border: none;
			outline: none;
			color: var(--text-normal);
			font-size: 13px;
			font-family: inherit;
			width: 130px;
		}

		.search-box input::placeholder {
			color: var(--text-muted);
		}

		.stats-badge {
			background-color: var(--bg-tertiary);
			color: var(--text-muted);
			font-size: 11px;
			padding: 4px 8px;
			border-radius: 4px;
			white-space: nowrap;
		}

				.topic-panel {
			position: sticky;
			top: 48px;
			z-index: 90;
			background-color: rgba(30, 31, 34, 0.95);
			backdrop-filter: blur(8px);
			border-bottom: 1px solid var(--border-subtle);
			padding: 10px 16px;
			font-size: 13px;
			color: var(--text-muted);
			transition: max-height 0.2s ease, opacity 0.2s ease;
			overflow: hidden;
		}

		.topic-panel.collapsed {
			display: none;
		}

				.preamble {
			display: grid;
			grid-template-columns: auto 1fr;
			max-width: 1200px;
			margin: 0 auto;
			padding: 24px 16px 16px 16px;
			gap: 16px;
		}

		.preamble__guild-icon-container {
			grid-column: 1;
		}

		.preamble__guild-icon {
			width: 72px;
			height: 72px;
			border-radius: 18px;
			object-fit: cover;
		}

		.preamble__guild-icon-placeholder {
			width: 72px;
			height: 72px;
			border-radius: 18px;
			background-color: var(--brand-color);
			color: #fff;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 32px;
			font-weight: 700;
		}

		.preamble__entries-container {
			grid-column: 2;
			display: flex;
			flex-direction: column;
			justify-content: center;
			gap: 4px;
		}

		.preamble__entry {
			color: var(--text-header);
			font-size: 1.3rem;
			font-weight: 700;
		}

		.preamble__channel-title {
			font-size: 1.1rem;
			color: var(--text-normal);
		}

		.preamble__entry--small {
			font-size: 0.875rem;
			font-weight: 400;
			color: var(--text-muted);
		}

				.chatlog {
			padding: 8px 0 40px 0;
			width: 100%;
			max-width: 1200px;
			margin: 0 auto;
		}

		.chatlog__message-group {
			margin-bottom: 12px;
		}

		.chatlog__message-container {
			background-color: transparent;
			transition: background-color 0.8s ease;
		}

		.chatlog__message-container--highlighted {
			background-color: rgba(114, 137, 218, 0.25) !important;
		}

		.chatlog__message-container--pinned {
			background-color: rgba(249, 168, 37, 0.05);
		}

		.chatlog__pinned-badge {
			display: inline-flex;
			align-items: center;
			margin-left: 6px;
			color: #f9a825;
			vertical-align: middle;
		}

		.chatlog__pinned-icon {
			width: 14px;
			height: 14px;
		}

		.chatlog__message {
			display: grid;
			grid-template-columns: 72px 1fr;
			padding: 2px 16px;
			min-height: 28px;
			transition: background-color 0.1s;
		}

		.chatlog__message:hover {
			background-color: var(--bg-hover);
		}

		.chatlog__message-aside {
			grid-column: 1;
			width: 72px;
			text-align: center;
			padding-top: 2px;
			flex-shrink: 0;
		}

		.chatlog__avatar {
			width: 40px;
			height: 40px;
			border-radius: 50%;
			object-fit: cover;
		}

		.chatlog__short-timestamp {
			display: none;
			color: var(--text-muted);
			font-size: 0.6875rem;
			font-weight: 500;
			line-height: 22px;
			user-select: none;
		}

		.chatlog__message:hover .chatlog__short-timestamp {
			display: block;
		}

		.chatlog__message-primary {
			grid-column: 2;
			min-width: 0;
			padding-right: 12px;
		}

				.chatlog__reply {
			display: flex;
			align-items: center;
			margin-bottom: 4px;
			font-size: 0.8125rem;
			color: #b5b6b8;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.chatlog__reply-symbol {
			width: 12px;
			height: 8px;
			margin-right: 6px;
			margin-left: 20px;
			border-left: 2px solid #4f545c;
			border-top: 2px solid #4f545c;
			border-top-left-radius: 6px;
			flex-shrink: 0;
		}

		.chatlog__reply-avatar {
			width: 16px;
			height: 16px;
			margin-right: 6px;
			border-radius: 50%;
			flex-shrink: 0;
		}

		.chatlog__reply-author {
			margin-right: 6px;
			font-weight: 600;
			color: #fff;
			flex-shrink: 0;
		}

		.chatlog__reply-link {
			color: #b5b6b8;
			cursor: pointer;
			overflow: hidden;
			text-overflow: ellipsis;
			text-decoration: none;
		}

		.chatlog__reply-link:hover {
			color: #fff;
			text-decoration: underline;
		}

				.chatlog__header {
			display: flex;
			align-items: baseline;
			gap: 6px;
			margin-bottom: 2px;
		}

		.chatlog__author {
			font-weight: 600;
			color: #ffffff;
			font-size: 1rem;
		}

		.chatlog__author-handle {
			font-size: 0.75rem;
			color: var(--text-muted);
		}

		.chatlog__author-tag {
			font-size: 0.625rem;
			font-weight: 700;
			background-color: var(--brand-color);
			color: #ffffff;
			padding: 1px 4px;
			border-radius: 3px;
			line-height: 1.2;
		}

		.chatlog__author-tag.system {
			background-color: #eb459e;
		}

		.chatlog__timestamp {
			color: var(--text-muted);
			font-size: 0.75rem;
			font-weight: 500;
			margin-left: 4px;
		}

				.chatlog__content {
			font-size: 0.95rem;
			color: var(--text-normal);
			word-wrap: break-word;
			line-height: 1.375;
		}

		.chatlog__content:empty {
			display: none;
		}

		.chatlog__content h1 { font-size: 1.4rem; font-weight: 700; margin: 8px 0 4px 0; color: var(--text-header); }
		.chatlog__content h2 { font-size: 1.2rem; font-weight: 700; margin: 6px 0 3px 0; color: var(--text-header); }
		.chatlog__content h3 { font-size: 1.05rem; font-weight: 600; margin: 4px 0 2px 0; color: var(--text-header); }
		.chatlog__markdown-subtext { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }

		.chatlog__markdown-quote {
			display: flex;
			margin: 4px 0;
		}

		.chatlog__markdown-quote-border {
			margin-right: 8px;
			border-left: 4px solid #4f545c;
			border-radius: 2px;
		}

		.chatlog__markdown-quote-content {
			color: var(--text-normal);
		}

		.chatlog__markdown-pre {
			background-color: var(--bg-secondary);
			font-family: var(--font-code);
			font-size: 0.85rem;
		}

		.chatlog__markdown-pre--multiline {
			display: block;
			margin: 6px 0;
			padding: 10px 12px;
			border: 1px solid var(--border-subtle);
			border-radius: 4px;
			color: #b9bbbe;
			white-space: pre-wrap;
			overflow-x: auto;
		}

		.chatlog__markdown-pre--inline {
			display: inline-block;
			padding: 2px 4px;
			border-radius: 3px;
		}

		.chatlog__markdown-mention {
			border-radius: 3px;
			padding: 0 4px;
			background-color: var(--mention-bg);
			color: var(--mention-text);
			font-weight: 500;
		}

		.chatlog__markdown-mention--role {
			background-color: rgba(255, 255, 255, 0.08);
			font-weight: 600;
		}

		.chatlog__markdown-mention:hover {
			background-color: var(--brand-color);
			color: #ffffff;
		}

		.chatlog__markdown-timestamp {
			background-color: rgba(255, 255, 255, 0.08);
			padding: 1px 4px;
			border-radius: 3px;
			font-size: 0.85rem;
		}

		.chatlog__emoji {
			width: 1.375rem;
			height: 1.375rem;
			vertical-align: -0.35rem;
			object-fit: contain;
			margin: 0 1px;
		}

		.chatlog__emoji--small {
			width: 1rem;
			height: 1rem;
		}

		.chatlog__emoji--large {
			width: 2.75rem;
			height: 2.75rem;
		}

				.chatlog__markdown-spoiler {
			background-color: rgba(255, 255, 255, 0.1);
			padding: 0 3px;
			border-radius: 3px;
		}

		.chatlog__markdown-spoiler--hidden {
			cursor: pointer;
			background-color: #202225;
			color: transparent;
			user-select: none;
		}

		.chatlog__markdown-spoiler--hidden:hover {
			background-color: rgba(32, 34, 37, 0.8);
		}

				.chatlog__attachments {
			margin-top: 6px;
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.chatlog__attachment-mosaic {
			display: grid;
			gap: 4px;
			border-radius: 8px;
			overflow: hidden;
			margin-top: 4px;
			max-width: 550px;
		}

		.chatlog__attachment-mosaic--2 {
			grid-template-columns: 1fr 1fr;
		}

		.chatlog__attachment-mosaic--3 {
			grid-template-columns: 1fr 1fr;
		}

		.chatlog__attachment-mosaic--3 .chatlog__attachment-mosaic-item:first-child {
			grid-row: span 2;
		}

		.chatlog__attachment-mosaic--4 {
			grid-template-columns: 1fr 1fr;
		}

		.chatlog__attachment-mosaic--5 {
			grid-template-columns: repeat(3, 1fr);
		}

		.chatlog__attachment-mosaic-item {
			position: relative;
			overflow: hidden;
			border-radius: 4px;
			max-height: 280px;
			display: flex;
			align-items: center;
			justify-content: center;
			background-color: var(--bg-secondary);
		}

		.chatlog__attachment-mosaic-item .chatlog__attachment-media {
			width: 100%;
			height: 100%;
			max-width: 100%;
			max-height: 280px;
			object-fit: cover;
		}

		.chatlog__attachment {
			position: relative;
			width: fit-content;
			border-radius: 4px;
			overflow: hidden;
		}

		.chatlog__attachment-media {
			max-width: 45vw;
			max-height: 450px;
			border-radius: 4px;
			display: block;
			object-fit: contain;
			cursor: pointer;
			transition: opacity 0.2s;
		}

		.chatlog__attachment-media:hover {
			opacity: 0.95;
		}

		.chatlog__attachment-audio {
			width: 100%;
			max-width: 400px;
		}

		.chatlog__attachment-info {
			font-size: 0.75rem;
			color: var(--text-muted);
			margin-top: 4px;
		}

		.chatlog__attachment--hidden {
			cursor: pointer;
		}

		.chatlog__attachment--hidden .chatlog__attachment-media {
			filter: blur(44px);
		}

		.chatlog__attachment-spoiler-caption {
			display: none;
			position: absolute;
			left: 50%;
			top: 50%;
			z-index: 10;
			padding: 6px 14px;
			border-radius: 20px;
			transform: translate(-50%, -50%);
			background-color: rgba(0, 0, 0, 0.85);
			color: #dcddde;
			font-size: 13px;
			font-weight: 700;
			letter-spacing: 0.5px;
		}

		.chatlog__attachment--hidden .chatlog__attachment-spoiler-caption {
			display: block;
		}

		.chatlog__attachment-generic {
			display: inline-flex;
			align-items: center;
			gap: 12px;
			background-color: var(--bg-secondary);
			border: 1px solid var(--border-subtle);
			border-radius: 6px;
			padding: 10px 14px;
			max-width: 420px;
		}

		.chatlog__attachment-generic-icon {
			color: var(--text-muted);
			width: 24px;
			height: 24px;
			flex-shrink: 0;
		}

		.chatlog__attachment-generic-details {
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}

		.chatlog__attachment-generic-name {
			color: #00a8fc;
			font-size: 14px;
			font-weight: 600;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.chatlog__attachment-generic-size {
			font-size: 11px;
			color: var(--text-muted);
		}

				.chatlog__embeds {
			margin-top: 6px;
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.chatlog__embed {
			display: flex;
			margin-top: 4px;
			max-width: 520px;
		}

		.chatlog__embed-color-pill {
			flex-shrink: 0;
			width: 4px;
			border-top-left-radius: 4px;
			border-bottom-left-radius: 4px;
		}

		.chatlog__embed-content-container {
			display: flex;
			flex-direction: column;
			padding: 10px 14px;
			border: 1px solid var(--border-subtle);
			border-top-right-radius: 4px;
			border-bottom-right-radius: 4px;
			background-color: var(--bg-secondary);
			width: 100%;
		}

		.chatlog__embed-content {
			display: flex;
			width: 100%;
		}

		.chatlog__embed-text {
			flex: 1;
		}

		.chatlog__embed-author-container {
			display: flex;
			align-items: center;
			gap: 6px;
			margin-bottom: 4px;
		}

		.chatlog__embed-author-icon {
			width: 18px;
			height: 18px;
			border-radius: 50%;
		}

		.chatlog__embed-author {
			color: var(--text-header);
			font-size: 0.8125rem;
			font-weight: 600;
		}

		.chatlog__embed-title {
			color: var(--text-header);
			font-size: 0.9375rem;
			font-weight: 700;
			margin-bottom: 4px;
		}

		.chatlog__embed-description {
			font-size: 0.875rem;
			color: var(--text-normal);
			margin-bottom: 6px;
			word-wrap: break-word;
		}

		.chatlog__embed-fields {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			gap: 8px;
			margin-top: 6px;
		}

		.chatlog__embed-field-name {
			font-size: 0.75rem;
			font-weight: 700;
			color: var(--text-header);
		}

		.chatlog__embed-field-value {
			font-size: 0.8125rem;
			color: var(--text-normal);
		}

		.chatlog__embed-thumbnail {
			max-width: 80px;
			max-height: 80px;
			margin-left: 12px;
			border-radius: 4px;
			object-fit: cover;
		}

		.chatlog__embed-image {
			max-width: 100%;
			max-height: 350px;
			border-radius: 4px;
			margin-top: 6px;
			cursor: pointer;
		}

		.chatlog__embed-footer {
			margin-top: 8px;
			display: flex;
			align-items: center;
			gap: 6px;
			color: var(--text-muted);
			font-size: 0.6875rem;
		}

		.chatlog__embed-footer-icon {
			width: 16px;
			height: 16px;
			border-radius: 50%;
		}

				.chatlog__reactions {
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
			margin-top: 6px;
		}

		.chatlog__reaction {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 2px 6px;
			border: 1px solid transparent;
			border-radius: 8px;
			background-color: var(--bg-secondary);
			cursor: default;
			transition: border-color 0.15s;
		}

		.chatlog__reaction:hover {
			border-color: rgba(255, 255, 255, 0.2);
		}

		.chatlog__reaction-count {
			color: var(--text-muted);
			font-size: 0.75rem;
			font-weight: 600;
		}

				.chatlog__stickers {
			margin-top: 6px;
		}

		.chatlog__sticker {
			width: 160px;
			height: 160px;
		}

		.chatlog__sticker lottie-player {
			width: 100%;
			height: 100%;
		}

		.chatlog__sticker--media {
			max-width: 100%;
			max-height: 100%;
			object-fit: contain;
		}

		.chatlog__components {
			margin-top: 6px;
			display: flex;
			flex-direction: column;
			gap: 6px;
			max-width: 540px;
		}

		.chatlog__component-container {
			background-color: var(--bg-secondary);
			border: 1px solid var(--border-subtle);
			border-radius: 8px;
			padding: 10px 12px;
			margin: 4px 0;
			border-left: 4px solid var(--border-subtle);
			transition: filter 0.2s;
		}

		.chatlog__component-container--spoiler {
			cursor: pointer;
		}

		.chatlog__component-container-inner {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}

		.chatlog__component-section {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 12px;
			margin: 2px 0;
		}

		.chatlog__component-section-content {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.chatlog__component-section-accessory {
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.chatlog__component-text-display {
			color: var(--text-normal);
			font-size: 0.9375rem;
			line-height: 1.375;
			word-break: break-word;
		}

		.chatlog__component-thumbnail {
			position: relative;
			max-width: 80px;
			max-height: 80px;
			border-radius: 6px;
			overflow: hidden;
			flex-shrink: 0;
		}

		.chatlog__component-thumbnail-img {
			width: 80px;
			height: 80px;
			object-fit: cover;
			border-radius: 6px;
			cursor: pointer;
			display: block;
		}

		.chatlog__component-media-gallery {
			display: grid;
			gap: 4px;
			border-radius: 8px;
			overflow: hidden;
			margin: 4px 0;
			max-width: 520px;
		}

		.chatlog__component-media-gallery--1 {
			grid-template-columns: 1fr;
		}

		.chatlog__component-media-gallery--2 {
			grid-template-columns: 1fr 1fr;
		}

		.chatlog__component-media-gallery--3 {
			grid-template-columns: 1fr 1fr;
		}

		.chatlog__component-media-gallery--4 {
			grid-template-columns: 1fr 1fr;
		}

		.chatlog__component-media-item {
			position: relative;
			overflow: hidden;
			max-height: 240px;
		}

		.chatlog__component-media-img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			cursor: pointer;
			display: block;
		}

		.chatlog__component-separator {
			width: 100%;
		}

		.chatlog__component-separator--divider {
			border-bottom: 1px solid var(--border-subtle);
		}

		.chatlog__component-separator--spacing-1 {
			margin: 6px 0;
		}

		.chatlog__component-separator--spacing-2 {
			margin: 12px 0;
		}

		.chatlog__component-separator--spacing-3 {
			margin: 18px 0;
		}

		.chatlog__component-action-row {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			align-items: center;
			margin: 4px 0;
		}

		.chatlog__component-button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			padding: 6px 14px;
			border-radius: 4px;
			font-size: 0.875rem;
			font-weight: 500;
			border: none;
			cursor: pointer;
			text-decoration: none;
			transition: background-color 0.15s, opacity 0.15s;
			max-width: 100%;
		}

		.chatlog__component-button--primary {
			background-color: #5865F2;
			color: #fff;
		}

		.chatlog__component-button--primary:hover {
			background-color: #4752c4;
		}

		.chatlog__component-button--secondary {
			background-color: #4e5058;
			color: #fff;
		}

		.chatlog__component-button--secondary:hover {
			background-color: #6d6f78;
		}

		.chatlog__component-button--success {
			background-color: #248046;
			color: #fff;
		}

		.chatlog__component-button--success:hover {
			background-color: #1a6334;
		}

		.chatlog__component-button--danger {
			background-color: #da373c;
			color: #fff;
		}

		.chatlog__component-button--danger:hover {
			background-color: #a12828;
		}

		.chatlog__component-button--link {
			background-color: #4e5058;
			color: #fff;
		}

		.chatlog__component-button--link:hover {
			background-color: #6d6f78;
		}

		.chatlog__component-button--premium {
			background: linear-gradient(90deg, #f47b67, #8045dd);
			color: #fff;
		}

		.chatlog__component-button--disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.chatlog__component-button-icon {
			width: 16px;
			height: 16px;
			fill: currentColor;
			margin-left: 2px;
			flex-shrink: 0;
		}

		.chatlog__component-emoji {
			width: 18px;
			height: 18px;
			object-fit: contain;
			vertical-align: middle;
		}

		.chatlog__component-select {
			background-color: var(--bg-secondary);
			border: 1px solid var(--border-subtle);
			border-radius: 4px;
			width: 100%;
			max-width: 440px;
			margin: 4px 0;
			overflow: hidden;
		}

		.chatlog__component-select-control {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 8px 12px;
			cursor: pointer;
			user-select: none;
		}

		.chatlog__component-select-placeholder {
			color: var(--text-muted);
			font-size: 0.875rem;
		}

		.chatlog__component-select-arrow {
			width: 18px;
			height: 18px;
			fill: var(--text-muted);
		}

		.chatlog__component-select-menu {
			border-top: 1px solid var(--border-subtle);
			max-height: 160px;
			overflow-y: auto;
			background-color: var(--bg-primary);
		}

		.chatlog__component-select-option {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 6px 12px;
			border-bottom: 1px solid rgba(255, 255, 255, 0.03);
			font-size: 0.8125rem;
			color: var(--text-normal);
		}

		.chatlog__component-select-option.selected {
			background-color: rgba(88, 101, 242, 0.15);
			color: #fff;
		}

		.chatlog__component-select-option-desc {
			font-size: 0.75rem;
			color: var(--text-muted);
			margin-left: 4px;
		}

		.chatlog__message-container--system {
			padding: 4px 0;
		}

		.chatlog__message--system {
			display: flex;
			align-items: center;
			gap: 12px;
			min-height: 28px;
		}

		.chatlog__system-icon {
			width: 18px;
			height: 18px;
			color: var(--text-muted);
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}

		.chatlog__system-icon svg {
			width: 100%;
			height: 100%;
		}

		.chatlog__system-content {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			font-size: 14px;
			color: var(--text-muted);
		}

		.chatlog__system-text {
			color: var(--text-muted);
		}

		.chatlog__poll {
			background-color: var(--bg-secondary);
			border: 1px solid var(--border-subtle);
			border-radius: 8px;
			padding: 16px;
			max-width: 520px;
			margin-top: 6px;
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		.chatlog__poll-question {
			font-size: 16px;
			font-weight: 700;
			color: var(--text-header);
		}

		.chatlog__poll-answers {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.chatlog__poll-answer {
			position: relative;
			background-color: var(--bg-primary);
			border: 1px solid var(--border-subtle);
			border-radius: 6px;
			overflow: hidden;
			min-height: 40px;
			display: flex;
			align-items: center;
		}

		.chatlog__poll-answer-fill {
			position: absolute;
			top: 0;
			bottom: 0;
			left: 0;
			background-color: rgba(88, 101, 242, 0.25);
			pointer-events: none;
		}

		.chatlog__poll-answer-content {
			position: relative;
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 8px 12px;
			gap: 8px;
			z-index: 1;
		}

		.chatlog__poll-answer-text {
			font-size: 14px;
			font-weight: 500;
			color: var(--text-normal);
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.chatlog__poll-answer-votes {
			font-size: 12px;
			font-weight: 600;
			color: var(--text-muted);
			white-space: nowrap;
		}

		.chatlog__poll-footer {
			display: flex;
			align-items: center;
			justify-content: space-between;
			font-size: 12px;
			color: var(--text-muted);
			padding-top: 4px;
			border-top: 1px solid var(--border-subtle);
		}

		.chatlog__poll-status {
			font-weight: 600;
			color: #949ba4;
		}

		.chatlog__forward-container {
			margin-top: 6px;
			margin-bottom: 4px;
			display: flex;
			flex-direction: column;
			gap: 6px;
			max-width: 560px;
		}

		.chatlog__forward-header {
			display: flex;
			align-items: center;
			gap: 6px;
			color: var(--text-muted);
			font-size: 12px;
			font-weight: 600;
			user-select: none;
		}

		.chatlog__forward-icon {
			width: 14px;
			height: 14px;
			flex-shrink: 0;
			color: var(--text-muted);
		}

		.chatlog__forward-label {
			font-size: 12px;
			font-weight: 600;
			color: var(--text-muted);
		}

		.chatlog__forward-card {
			background-color: var(--bg-secondary);
			border: 1px solid var(--border-subtle);
			border-left: 3px solid #5865f2;
			border-radius: 8px;
			padding: 12px 14px;
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.chatlog__forward-author-header {
			display: flex;
			align-items: center;
			gap: 8px;
			flex-wrap: wrap;
		}

		.chatlog__forward-avatar {
			width: 20px;
			height: 20px;
			border-radius: 50%;
			object-fit: cover;
			flex-shrink: 0;
		}

		.chatlog__forward-author-name {
			font-size: 14px;
			font-weight: 600;
			color: var(--text-header);
		}

		.chatlog__forward-author-handle {
			font-size: 12px;
			color: var(--text-muted);
		}

		.chatlog__forward-timestamp {
			font-size: 11px;
			color: var(--text-muted);
			margin-left: 2px;
		}

		.chatlog__forward-content {
			font-size: 15px;
			color: var(--text-normal);
		}

		.chatlog__edited-timestamp {
			margin-left: 4px;
			font-size: 0.625rem;
			line-height: 1;
			color: var(--text-muted);
			cursor: default;
			user-select: none;
		}

		.chatlog__interaction {
			display: flex;
			align-items: center;
			gap: 6px;
			margin-bottom: 4px;
			font-size: 0.8125rem;
			color: var(--text-muted);
		}

		.chatlog__interaction-avatar {
			width: 14px;
			height: 14px;
			border-radius: 50%;
			object-fit: cover;
		}

		.chatlog__interaction-author {
			font-weight: 600;
			color: var(--text-normal);
		}

		.chatlog__interaction-text {
			color: var(--text-muted);
		}

		.chatlog__interaction-command {
			color: var(--brand-color);
			font-weight: 500;
		}

		.chatlog__attachment--voice {
			display: flex;
			flex-direction: column;
			gap: 6px;
			background-color: var(--bg-secondary);
			border: 1px solid var(--border-subtle);
			border-radius: 8px;
			padding: 8px 12px;
			max-width: 400px;
		}

		.chatlog__voice-badge {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			font-size: 12px;
			font-weight: 600;
			color: var(--brand-color);
		}

		.chatlog__voice-icon {
			width: 14px;
			height: 14px;
		}

		.postamble {
			padding: 24px 16px;
			max-width: 1200px;
			margin: 0 auto;
			border-top: 1px solid var(--border-subtle);
			color: var(--text-muted);
			font-size: 0.8125rem;
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.postamble__entry:first-child {
			color: var(--text-header);
			font-weight: 600;
		}

				.lightbox-modal {
			display: none;
			position: fixed;
			top: 0;
			left: 0;
			width: 100vw;
			height: 100vh;
			background-color: rgba(0, 0, 0, 0.88);
			backdrop-filter: blur(6px);
			z-index: 9999;
			align-items: center;
			justify-content: center;
			cursor: zoom-out;
			padding: 16px;
		}

		.lightbox-modal.active {
			display: flex;
		}

		.lightbox-box {
			display: flex;
			align-items: center;
			justify-content: center;
			max-width: 95vw;
			max-height: 95vh;
			cursor: default;
		}

		.lightbox-img {
			max-width: 90vw;
			max-height: 85vh;
			object-fit: contain;
			border-radius: 6px;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
		}

				.floating-actions {
			position: fixed;
			bottom: 24px;
			right: 24px;
			display: flex;
			flex-direction: column;
			gap: 10px;
			z-index: 999;
		}

		.floating-btn {
			width: 40px;
			height: 40px;
			border-radius: 50%;
			background-color: var(--brand-color);
			color: #fff;
			border: none;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
			transition: background-color 0.2s, transform 0.1s;
		}

		.floating-btn:hover {
			background-color: var(--brand-hover);
			transform: scale(1.05);
		}

		.floating-btn svg {
			fill: currentColor;
			width: 18px;
			height: 18px;
		}

		@media (max-width: 768px) {
			header {
				padding: 6px 12px;
			}
			.search-box input {
				width: 90px;
			}
			.chatlog__message {
				grid-template-columns: 52px 1fr;
				padding: 2px 8px;
			}
			.chatlog__message-aside {
				width: 52px;
			}
			.chatlog__avatar {
				width: 34px;
				height: 34px;
			}
			.chatlog__attachment-media {
				max-width: 75vw;
			}
		}
	</style>
	<script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>
</head>
<body>
	<header>
		<div class="header-left">
			<span class="channel-hash">#</span>
			<div class="channel-title-wrap">
				<span class="channel-name">${channelName}</span>
				<span class="guild-name">${guildName}</span>
			</div>
			${topic ? `<button class="topic-toggle-btn" onclick="toggleTopic()">Topic</button>` : ''}
		</div>
		<div class="header-right">
			<div class="search-box">
				<input type="text" id="searchInput" placeholder="Search..." />
			</div>
			<div class="stats-badge" id="statsBadge" title="Exported ${exportTime}">
				${messages.length} msgs
			</div>
		</div>
	</header>

	${topic ? `<div id="topicPanel" class="topic-panel collapsed">${topic}</div>` : ''}

	<div class="preamble">
		<div class="preamble__guild-icon-container">
			${
				meta.guildIconUrl
					? `<img class="preamble__guild-icon" src="${escapeHtml(meta.guildIconUrl)}" alt="Guild icon" loading="lazy" />`
					: '<div class="preamble__guild-icon-placeholder">#</div>'
			}
		</div>
		<div class="preamble__entries-container">
			<div class="preamble__entry">${guildName}</div>
			<div class="preamble__channel-title">#${channelName}</div>
			${topic ? `<div class="preamble__entry preamble__entry--small">${topic}</div>` : ''}
			<div class="preamble__entry preamble__entry--small">${escapeHtml(meta.rangeDescription || `Exported ${messages.length} message(s)`)} • ${exportTime}</div>
		</div>
	</div>

	<main class="chatlog" id="chatStream">
		${groupsHtml || '<div style="text-align:center; padding:40px; color:var(--text-muted);">No messages found.</div>'}
	</main>

	<div class="postamble">
		<div class="postamble__entry">Exported ${messages.length} message(s)</div>
		<div class="postamble__entry">${guildName} • #${channelName} • ${exportTime}</div>
	</div>

	<div id="lightbox" class="lightbox-modal" onclick="closeLightbox(event)">
		<div class="lightbox-box">
			<img id="lightboxImg" class="lightbox-img" src="" alt="Preview" />
		</div>
	</div>

	<div class="floating-actions">
		<button class="floating-btn" title="Jump to top" onclick="window.scrollTo({ top: 0, behavior: 'smooth' })">
			<svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
		</button>
		<button class="floating-btn" title="Jump to bottom" onclick="window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })">
			<svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
		</button>
	</div>

	<script>
		function openLightbox(url) {
			const lb = document.getElementById('lightbox');
			const img = document.getElementById('lightboxImg');
			img.src = url;
			lb.classList.add('active');
		}

		function closeLightbox(e) {
			if (!e || e.target !== document.getElementById('lightboxImg')) {
				const lb = document.getElementById('lightbox');
				lb.classList.remove('active');
				document.getElementById('lightboxImg').src = '';
			}
		}

		document.addEventListener('keydown', function(e) {
			if (e.key === 'Escape') {
				closeLightbox();
			}
		});

		function showSpoiler(event, element) {
			if (!element) return;
			if (element.classList.contains('chatlog__attachment--hidden')) {
				event.preventDefault();
				element.classList.remove('chatlog__attachment--hidden');
			}
			if (element.classList.contains('chatlog__markdown-spoiler--hidden')) {
				event.preventDefault();
				element.classList.remove('chatlog__markdown-spoiler--hidden');
			}
		}

		function scrollToMessage(event, id) {
			const element = document.getElementById('chatlog__message-container-' + id);
			if (!element) return;
			event.preventDefault();
			element.classList.add('chatlog__message-container--highlighted');
			window.scrollTo({
				top: element.getBoundingClientRect().top + window.pageYOffset - (window.innerHeight / 2),
				behavior: 'smooth'
			});
			setTimeout(function() {
				element.classList.remove('chatlog__message-container--highlighted');
			}, 2000);
		}

		function toggleTopic() {
			const panel = document.getElementById('topicPanel');
			if (panel) {
				panel.classList.toggle('collapsed');
			}
		}

		const searchInput = document.getElementById('searchInput');
		const statsBadge = document.getElementById('statsBadge');
		const containers = document.querySelectorAll('.chatlog__message-container');
		const totalCount = containers.length;

		if (searchInput) {
			searchInput.addEventListener('input', function() {
				const query = searchInput.value.toLowerCase().trim();
				let visible = 0;
				containers.forEach(function(c) {
					const text = c.innerText.toLowerCase();
					const match = !query || text.includes(query);
					c.style.display = match ? '' : 'none';
					if (match) visible++;
				});
				statsBadge.innerText = query ? visible + ' / ' + totalCount + ' msgs' : totalCount + ' msgs';
			});
		}
	</script>
</body>
</html>`
}
