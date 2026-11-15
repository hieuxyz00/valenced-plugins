import { generateDiscordChatHtml } from './htmlExporter'
import type { ChannelExportMetadata, DiscordMessage, Settings } from '../types'

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

export function formatMessageToText(
	message: DiscordMessage,
	settings: Settings,
): string {
	const parts: string[] = []

	let header = ''
	if (settings.includeTimestamps && message.timestamp) {
		const date = new Date(message.timestamp)
		if (!Number.isNaN(date.getTime())) {
			header += `[${date.toLocaleString()}] `
		}
	}
	header += `${formatAuthorName(message.author)}:`
	parts.push(`${header} ${message.content ?? ''}`)

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
			parts.push(`    - ${attachment.filename}${sizeStr}: ${attachment.url}`)
		}
	}

	if (settings.includeEmbeds && message.embeds && message.embeds.length > 0) {
		parts.push('  Embeds:')
		for (const embed of message.embeds) {
			if (embed.title) {
				parts.push(`    - Title: ${embed.title}`)
			}
			if (embed.url) {
				parts.push(`      URL: ${embed.url}`)
			}
			if (embed.description) {
				parts.push(`      Description: ${embed.description}`)
			}
			if (embed.fields && embed.fields.length > 0) {
				for (const field of embed.fields) {
					parts.push(`      • ${field.name}: ${field.value}`)
				}
			}
		}
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

export function formatMessageToJson(
	message: DiscordMessage,
	settings: Settings,
): string {
	const output: Record<string, unknown> = {
		id: message.id,
		channel_id: message.channel_id,
		author: {
			id: message.author.id,
			username: message.author.username,
			discriminator: message.author.discriminator,
			globalName: message.author.globalName,
			bot: message.author.bot,
			avatar: message.author.avatar,
		},
		content: message.content ?? '',
	}

	if (settings.includeTimestamps && message.timestamp) {
		output.timestamp = message.timestamp
	}

	if (settings.includeAttachments && message.attachments) {
		output.attachments = message.attachments.map(att => ({
			filename: att.filename,
			url: att.url,
			size: att.size,
			contentType: att.content_type,
		}))
	}

	if (settings.includeEmbeds && message.embeds) {
		output.embeds = message.embeds.map(emb => ({
			title: emb.title,
			description: emb.description,
			url: emb.url,
			fields: emb.fields,
		}))
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
