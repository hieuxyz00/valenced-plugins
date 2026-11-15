import { Stores } from '@valenced/discord/flux'
import type {
	ChannelExportMetadata,
	DiscordAttachment,
	DiscordEmbed,
	DiscordMessage,
	Settings,
} from '../types'

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
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
		  }
		| undefined
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

	safe = safe.replace(
		/&lt;@&amp;(\d+)&gt;/g,
		'<span class="chatlog__markdown-mention">@role</span>',
	)

	safe = safe.replace(
		/@everyone/g,
		'<span class="chatlog__markdown-mention">@everyone</span>',
	)
	safe = safe.replace(
		/@here/g,
		'<span class="chatlog__markdown-mention">@here</span>',
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

function renderAttachment(attachment: DiscordAttachment): string {
	const filename = escapeHtml(attachment.filename)
	const url = escapeHtml(attachment.url)
	const size = formatFileSize(attachment.size)
	const lowerName = attachment.filename.toLowerCase()

	const isImage =
		/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerName) ||
		attachment.content_type?.startsWith('image/')
	const isVideo =
		/\.(mp4|webm|mov|m4v)$/i.test(lowerName) ||
		attachment.content_type?.startsWith('video/')
	const isAudio =
		/\.(mp3|wav|ogg|m4a|aac)$/i.test(lowerName) ||
		attachment.content_type?.startsWith('audio/')
	const isSpoiler = attachment.filename.startsWith('SPOILER_')

	if (isImage) {
		const hiddenClass = isSpoiler ? ' chatlog__attachment--hidden' : ''
		const spoilerBadge = isSpoiler
			? '<div class="chatlog__attachment-spoiler-caption">SPOILER</div>'
			: ''
		return `<div class="chatlog__attachment${hiddenClass}" ${isSpoiler ? 'onclick="showSpoiler(event, this)"' : ''}>${spoilerBadge}<img class="chatlog__attachment-media" src="${url}" alt="${filename}" loading="lazy" onclick="openLightbox('${url}')" /><div class="chatlog__attachment-info">${filename} ${size ? `(${size})` : ''}</div></div>`
	}

	if (isVideo) {
		return `<div class="chatlog__attachment"><video class="chatlog__attachment-media" controls preload="metadata" src="${url}"></video><div class="chatlog__attachment-info">${filename} ${size ? `(${size})` : ''}</div></div>`
	}

	if (isAudio) {
		return `<div class="chatlog__attachment"><audio class="chatlog__attachment-audio" controls preload="metadata" src="${url}"></audio><div class="chatlog__attachment-info">${filename} ${size ? `(${size})` : ''}</div></div>`
	}

	return `<div class="chatlog__attachment-generic"><svg class="chatlog__attachment-generic-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg><div class="chatlog__attachment-generic-details"><a class="chatlog__attachment-generic-name" href="${url}" target="_blank" rel="noopener noreferrer">${filename}</a>${size ? `<span class="chatlog__attachment-generic-size">${size}</span>` : ''}</div></div>`
}

function renderEmbed(
	embed: DiscordEmbed,
	userMap: Map<string, string>,
	channelMap: Map<string, string>,
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
		? `<div class="chatlog__embed-description">${parseMarkdown(embed.description, userMap, channelMap)}</div>`
		: ''

	let fieldsHtml = ''
	if (embed.fields && embed.fields.length > 0) {
		const fieldItems = embed.fields
			.map(
				f =>
					`<div class="chatlog__embed-field ${f.inline ? 'chatlog__embed-field--inline' : ''}"><div class="chatlog__embed-field-name">${escapeHtml(f.name)}</div><div class="chatlog__embed-field-value">${parseMarkdown(f.value, userMap, channelMap)}</div></div>`,
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
	const messageMap = new Map<string, DiscordMessage>()

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

			const parsedContent = parseMarkdown(
				msg.content ?? '',
				userMap,
				channelMap,
			)

			let attachmentsHtml = ''
			if (
				settings.includeAttachments &&
				msg.attachments &&
				msg.attachments.length > 0
			) {
				attachmentsHtml = `<div class="chatlog__attachments">${msg.attachments.map(renderAttachment).join('')}</div>`
			}

			let embedsHtml = ''
			if (settings.includeEmbeds && msg.embeds && msg.embeds.length > 0) {
				embedsHtml = `<div class="chatlog__embeds">${msg.embeds.map(e => renderEmbed(e, userMap, channelMap)).join('')}</div>`
			}

			let reactionsHtml = ''
			if (msg.reactions && msg.reactions.length > 0) {
				const reactionItems = msg.reactions
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
			if (msg.stickerItems && msg.stickerItems.length > 0) {
				const stickerItems = msg.stickerItems
					.map(
						s =>
							`<div class="chatlog__sticker" title="${escapeHtml(s.name)}"><img class="chatlog__sticker--media" src="https://media.discordapp.net/stickers/${s.id}.png?size=160" alt="${escapeHtml(s.name)}" loading="lazy" /></div>`,
					)
					.join('')
				stickersHtml = `<div class="chatlog__stickers">${stickerItems}</div>`
			}

			let replyHtml = ''
			const refId =
				msg.referencedMessage?.id ?? msg.messageReference?.message_id
			if (refId) {
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

				groupInner += `<div id="chatlog__message-container-${msg.id}" class="chatlog__message-container ${msg.pinned ? 'chatlog__message-container--pinned' : ''}" data-message-id="${msg.id}"><div class="chatlog__message"><div class="chatlog__message-aside"><img class="chatlog__avatar" src="${avatarUrl}" alt="${displayName}" loading="lazy" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"/></div><div class="chatlog__message-primary">${replyHtml}<div class="chatlog__header"><span class="chatlog__author" style="${authorColor}">${displayName}</span>${hasHandle ? `<span class="chatlog__author-handle">@${username}</span>` : ''}${botBadge}${systemBadge}${settings.includeTimestamps && formattedDate ? `<span class="chatlog__timestamp" title="${formattedDate}">${formattedDate}</span>` : ''}</div><div class="chatlog__content">${parsedContent}</div>${attachmentsHtml}${embedsHtml}${stickersHtml}${reactionsHtml}</div></div></div>`
			} else {
				groupInner += `<div id="chatlog__message-container-${msg.id}" class="chatlog__message-container ${msg.pinned ? 'chatlog__message-container--pinned' : ''}" data-message-id="${msg.id}"><div class="chatlog__message chatlog__message--coalesced"><div class="chatlog__message-aside"><span class="chatlog__short-timestamp" title="${formattedDate}">${shortTime}</span></div><div class="chatlog__message-primary">${replyHtml}<div class="chatlog__content">${parsedContent}</div>${attachmentsHtml}${embedsHtml}${stickersHtml}${reactionsHtml}</div></div></div>`
			}
		}

		groupsHtml += `<div class="chatlog__message-group">${groupInner}</div>`
		currentGroupMessages = []
	}

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]
		const authorId = msg.author?.id ?? '0'
		const msgTime = msg.timestamp ? new Date(msg.timestamp).getTime() : 0
		const hasReply = Boolean(
			msg.referencedMessage || msg.messageReference?.message_id,
		)

		const shouldCoalesce =
			!hasReply &&
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
			currentGroupAuthorId = authorId
			currentGroupTimestamp = msgTime
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

		.chatlog__sticker--media {
			max-width: 100%;
			max-height: 100%;
			object-fit: contain;
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
