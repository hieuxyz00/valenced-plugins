import type { ContentNode } from '../types'

function appendEllipsisToLastText(list: ContentNode[]): boolean {
	for (let i = list.length - 1; i >= 0; i--) {
		const item = list[i]
		if (
			(item?.type === 'text' || item?.type === 'codeBlock') &&
			typeof item.content === 'string'
		) {
			if (!item.content.endsWith('…')) {
				list[i] = {
					...item,
					content: `${item.content}…`,
				}
			}
			return true
		}
		if (Array.isArray(item?.content)) {
			const childList = [...(item.content as ContentNode[])]
			if (appendEllipsisToLastText(childList)) {
				list[i] = {
					...item,
					content: childList,
				}
				return true
			}
		}
	}
	return false
}

function isBlockNode(node: ContentNode): boolean {
	return (
		node.type === 'codeBlock' ||
		node.type === 'blockQuote' ||
		node.type === 'heading' ||
		node.type === 'list' ||
		node.type === 'attachment'
	)
}

export function normalizeBlockNodes(nodes: ContentNode[]): ContentNode[] {
	const result: ContentNode[] = []

	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i]
		if (!node) continue

		if (node.type === 'list' && Array.isArray(node.items)) {
			const isOrdered = Boolean(node.ordered)
			const startNum = typeof node.start === 'number' ? node.start : 1
			node.items.forEach((itemGroup, idx) => {
				const prefix = `${idx > 0 ? '\n' : ''}${isOrdered ? `${startNum + idx}. ` : '• '}`
				result.push({ type: 'text', content: prefix })
				if (Array.isArray(itemGroup)) {
					result.push(...normalizeBlockNodes(itemGroup as ContentNode[]))
				}
			})
			if (i < nodes.length - 1) {
				result.push({ type: 'text', content: '\n' })
			}
			continue
		}

		if (node.type === 'heading' && Array.isArray(node.content)) {
			result.push({
				type: 'strong',
				content: normalizeBlockNodes(node.content as ContentNode[]),
			})
			if (i < nodes.length - 1) {
				result.push({ type: 'text', content: '\n' })
			}
			continue
		}

		if (node.type === 'blockQuote' && Array.isArray(node.content)) {
			result.push({ type: 'text', content: '> ' })
			result.push(...normalizeBlockNodes(node.content as ContentNode[]))
			if (i < nodes.length - 1) {
				result.push({ type: 'text', content: '\n' })
			}
			continue
		}

		if (Array.isArray(node.content)) {
			result.push({
				...node,
				content: normalizeBlockNodes(node.content as ContentNode[]),
			})
			continue
		}

		result.push(node)
	}

	return result
}

export function cleanLineBreaks(
	nodes: ContentNode[],
	trimContentIndents: boolean,
	collapseEmpty: boolean,
): ContentNode[] {
	return nodes.map(node => {
		if (node.type === 'text' && typeof node.content === 'string') {
			let text = node.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
			if (collapseEmpty) {
				text = text.replace(/\n{3,}/g, '\n\n')
			}
			if (trimContentIndents) {
				text = text
					.split('\n')
					.map(line => line.trimStart())
					.join('\n')
			}
			return {
				...node,
				content: text,
			}
		}
		if (Array.isArray(node.content)) {
			return {
				...node,
				content: cleanLineBreaks(
					node.content as ContentNode[],
					trimContentIndents,
					collapseEmpty,
				),
			}
		}
		return node
	})
}

export function flattenNewlines(nodes: ContentNode[]): ContentNode[] {
	return nodes.map(node => {
		if (
			(node.type === 'text' || node.type === 'codeBlock') &&
			typeof node.content === 'string'
		) {
			return {
				...node,
				content: node.content.replace(/\r?\n/g, ' '),
			}
		}
		if (Array.isArray(node.content)) {
			return {
				...node,
				content: flattenNewlines(node.content as ContentNode[]),
			}
		}
		return node
	})
}

export function clampLines(
	nodes: ContentNode[],
	maxLines: number,
): ContentNode[] {
	if (maxLines <= 0) return nodes

	let currentLine = 1
	let isLineStart = true
	let truncated = false

	function processNodes(input: ContentNode[]): ContentNode[] {
		const result: ContentNode[] = []

		for (const node of input) {
			if (truncated) break

			if (isBlockNode(node)) {
				if (!isLineStart) {
					currentLine++
					isLineStart = true
				}
				if (currentLine > maxLines) {
					truncated = true
					appendEllipsisToLastText(result)
					break
				}
			}

			if (node.type === 'text' && typeof node.content === 'string') {
				const lines = node.content.split('\n')
				if (lines.length === 1) {
					if (currentLine > maxLines) {
						truncated = true
						appendEllipsisToLastText(result)
						break
					}
					result.push(node)
					isLineStart = false
				} else {
					const kept: string[] = []
					for (let i = 0; i < lines.length; i++) {
						if (i > 0) {
							currentLine++
							isLineStart = true
						}
						if (currentLine > maxLines) {
							truncated = true
							break
						}
						kept.push(lines[i] as string)
						isLineStart = false
					}
					if (kept.length > 0) {
						result.push({
							...node,
							content: kept.join('\n'),
						})
					}
					if (truncated) {
						appendEllipsisToLastText(result)
						break
					}
				}
				continue
			}

			if (node.type === 'codeBlock' && typeof node.content === 'string') {
				const lines = node.content.split('\n')
				const remainingQuota = maxLines - currentLine + 1
				if (remainingQuota <= 0) {
					truncated = true
					appendEllipsisToLastText(result)
					break
				}
				if (lines.length > remainingQuota) {
					truncated = true
					const kept = lines.slice(0, remainingQuota).join('\n')
					result.push({
						...node,
						content: kept,
					})
					appendEllipsisToLastText(result)
					break
				}
				currentLine += Math.max(0, lines.length - 1)
				isLineStart = false
				result.push(node)
				continue
			}

			if (Array.isArray(node.content)) {
				const childProcessed = processNodes(node.content as ContentNode[])
				result.push({
					...node,
					content: childProcessed,
				})
				continue
			}

			if (currentLine > maxLines) {
				truncated = true
				appendEllipsisToLastText(result)
				break
			}

			result.push(node)
		}

		return result
	}

	return processNodes(nodes)
}

export function clampChars(
	nodes: ContentNode[],
	maxChars: number,
): ContentNode[] {
	if (maxChars <= 0) return nodes

	let remaining = maxChars
	let truncated = false

	function processNodes(input: ContentNode[]): ContentNode[] {
		const result: ContentNode[] = []

		for (const node of input) {
			if (truncated) break

			if (
				(node.type === 'text' || node.type === 'codeBlock') &&
				typeof node.content === 'string'
			) {
				const len = node.content.length
				if (len <= remaining) {
					remaining -= len
					result.push(node)
				} else {
					const sliced = node.content.slice(0, Math.max(0, remaining))
					result.push({
						...node,
						content: `${sliced}…`,
					})
					remaining = 0
					truncated = true
					break
				}
				continue
			}

			if (Array.isArray(node.content)) {
				const childProcessed = processNodes(node.content as ContentNode[])
				result.push({
					...node,
					content: childProcessed,
				})
				continue
			}

			if (remaining > 0) {
				remaining--
				result.push(node)
			} else {
				truncated = true
				appendEllipsisToLastText(result)
				break
			}
		}

		return result
	}

	return processNodes(nodes)
}
