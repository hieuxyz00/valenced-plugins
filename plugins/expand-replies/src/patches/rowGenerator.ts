import { onFluxEventDispatched, Stores } from '@valenced/discord/flux'
import { getModules, lookupModule } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { after } from '@valenced/patcher'
import { getErrorStack } from '@valenced/utils/error'
import { DefaultSettings } from '../types'
import {
	clampChars,
	clampLines,
	cleanLineBreaks,
	flattenNewlines,
	normalizeBlockNodes,
} from '../utils/clamp'
import type { DiscordModules } from '@valenced/discord/types'
import type { JsonStorage } from '@valenced/json-storage'
import type {
	ContentNode,
	MarkupParserModule,
	MessageRow,
	RowManager,
	Settings,
} from '../types'

interface PluginInstance {
	reportError(error: unknown): void
}

interface MessageStoreType {
	getMessage(channelId: string, id: string): unknown
}

interface ReferencedMessageStoreType {
	getMessageByReference(ref: {
		channel_id: string
		message_id: string
	}): { state: number; message: unknown } | undefined
}

const MESSAGE_ROW_TYPE = 1
const CACHE_MAX_ENTRIES = 64
const EXPANDED_KEY = Symbol.for('hieuxyz.expand-replies.key')

export function patchRowGenerator(
	cleanup: (fn: () => void) => void,
	storage: JsonStorage<Settings>,
	plugin: PluginInstance,
) {
	let markupModule: MarkupParserModule | undefined
	const patchedPrototypes = new WeakSet<object>()
	const replyCache = new Map<string, ContentNode[]>()

	function clearCache() {
		replyCache.clear()
	}

	cleanup(clearCache)

	try {
		const unsubFlux = onFluxEventDispatched('CHANNEL_SELECT', payload => {
			clearCache()
			return payload
		})
		if (typeof unsubFlux === 'function') {
			cleanup(unsubFlux)
		}
	} catch {}

	function patchMarkup(exports: unknown) {
		if (!exports || typeof exports !== 'object') return
		const typedMod = exports as MarkupParserModule
		if (typeof typedMod.parseMessageMarkup !== 'function') return
		markupModule = typedMod
	}

	function patchRowMgr(mod: unknown) {
		if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) return
		const target = (mod as { prototype?: unknown })?.prototype
			? (mod as { prototype: { generate: unknown } })
			: (mod as { default?: { prototype?: { generate: unknown } } })?.default
		const proto = target?.prototype as
			| { generate?: (...args: unknown[]) => unknown }
			| undefined
		if (
			!proto ||
			typeof proto.generate !== 'function' ||
			patchedPrototypes.has(proto)
		) {
			return
		}
		patchedPrototypes.add(proto)
		const targetProto = proto as Record<
			'generate',
			(...args: unknown[]) => unknown
		>

		cleanup(
			after(targetProto, 'generate', row => {
				const typedRow = row as MessageRow | undefined
				if (typedRow?.type !== MESSAGE_ROW_TYPE || !typedRow.message) {
					return row
				}

				const referenced = typedRow.message.referencedMessage
				if (referenced?.state !== 0 || !referenced?.message) {
					return row
				}

				try {
					const refMsg = referenced.message as Record<string | symbol, unknown>
					const replyId = refMsg.id
					if (!replyId || typeof replyId !== 'string') return row

					const settings =
						(storage.cache as Partial<Settings> | undefined) ?? DefaultSettings
					const preserveNewlines =
						settings.preserveNewlines ?? DefaultSettings.preserveNewlines
					const alignWithLine1 =
						settings.alignWithLine1 ?? DefaultSettings.alignWithLine1
					const trimContentIndents =
						settings.trimContentIndents ?? DefaultSettings.trimContentIndents
					const collapseEmptyLines =
						settings.collapseEmptyLines ?? DefaultSettings.collapseEmptyLines
					const maxLines = settings.maxLines ?? DefaultSettings.maxLines
					const maxChars = settings.maxChars ?? DefaultSettings.maxChars

					const cacheKey = `${replyId}:${maxLines}:${maxChars}:${preserveNewlines ? 1 : 0}:${alignWithLine1 ? 1 : 0}:${trimContentIndents ? 1 : 0}:${collapseEmptyLines ? 1 : 0}`

					if (refMsg[EXPANDED_KEY] === cacheKey) {
						return row
					}

					const cachedResult = replyCache.get(cacheKey)
					if (cachedResult) {
						replyCache.delete(cacheKey)
						replyCache.set(cacheKey, cachedResult)
						refMsg.content = cachedResult
						refMsg[EXPANDED_KEY] = cacheKey
						return row
					}

					let content: ContentNode[] | undefined

					const channelId =
						refMsg.channelId ||
						(refMsg as Record<string, unknown>).channel_id ||
						typedRow.message.channelId ||
						(typedRow.message as Record<string, unknown>).channel_id ||
						''

					const messageStore = Stores.MessageStore as
						| DiscordModules.Flux.Store<MessageStoreType>
						| undefined
					const referencedStore = Stores.ReferencedMessageStore as
						| DiscordModules.Flux.Store<ReferencedMessageStoreType>
						| undefined

					const rawMsg =
						(typeof channelId === 'string' && channelId
							? messageStore?.getMessage?.(channelId, replyId)
							: undefined) ??
						referencedStore?.getMessageByReference?.({
							channel_id: typeof channelId === 'string' ? channelId : '',
							message_id: replyId,
						})?.message

					const record = (rawMsg ?? refMsg) as
						| { content?: string; embeds?: unknown[]; attachments?: unknown[] }
						| undefined

					if (
						record &&
						typeof record.content === 'string' &&
						record.content.trim()
					) {
						let cleanContent = record.content
						if (collapseEmptyLines) {
							cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n')
						}
						if (trimContentIndents) {
							cleanContent = cleanContent
								.split('\n')
								.map(line => line.trimStart())
								.join('\n')
						}

						if (markupModule?.parseMessageMarkup && rawMsg) {
							try {
								const fake = Object.assign(
									Object.create(Object.getPrototypeOf(rawMsg)),
									rawMsg,
									{
										content: cleanContent,
										embeds: Array.isArray(record.embeds) ? record.embeds : [],
										attachments: Array.isArray(record.attachments)
											? record.attachments
											: [],
									},
								)
								const parsed = markupModule.parseMessageMarkup(
									fake,
									fake,
									false,
									!preserveNewlines,
									false,
									true,
									true,
								)
								if (parsed?.content && Array.isArray(parsed.content)) {
									content = normalizeBlockNodes(parsed.content as ContentNode[])
								}
							} catch {
								content = [{ type: 'text', content: cleanContent }]
							}
						} else {
							content = [{ type: 'text', content: cleanContent }]
						}
					}

					if (!content) {
						if (Array.isArray(refMsg.content) && refMsg.content.length > 0) {
							content = normalizeBlockNodes(refMsg.content as ContentNode[])
						}
					}

					if (!content || !Array.isArray(content)) {
						refMsg[EXPANDED_KEY] = cacheKey
						return row
					}

					if (!preserveNewlines) {
						content = flattenNewlines(content)
					} else {
						content = cleanLineBreaks(
							content,
							trimContentIndents,
							collapseEmptyLines,
						)
					}

					if (maxLines > 0) {
						content = clampLines(content, maxLines)
					}

					if (maxChars > 0) {
						content = clampChars(content, maxChars)
					}

					if (replyCache.size >= CACHE_MAX_ENTRIES) {
						const oldestKey = replyCache.keys().next().value
						if (oldestKey !== undefined) {
							replyCache.delete(oldestKey)
						}
					}
					replyCache.set(cacheKey, content)

					refMsg.content = content
					refMsg[EXPANDED_KEY] = cacheKey
				} catch (e) {
					plugin.reportError(
						`Failed to expand referenced message: ${getErrorStack(e)}`,
					)
				}

				return row
			}),
		)
	}

	try {
		const [existingMarkup] = lookupModule(
			withProps<MarkupParserModule>('parseMessageMarkup'),
		)
		if (existingMarkup) patchMarkup(existingMarkup)
	} catch {}

	try {
		const [existingRowMgr] = lookupModule(withName<RowManager>('RowManager'))
		if (existingRowMgr) patchRowMgr(existingRowMgr)
	} catch {}

	cleanup(
		getModules(withProps<MarkupParserModule>('parseMessageMarkup'), exports => {
			patchMarkup(exports)
		}),
	)

	cleanup(
		getModules(withName<RowManager>('RowManager'), mod => {
			patchRowMgr(mod)
		}),
	)
}
