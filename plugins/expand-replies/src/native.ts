import { callNativeMethodSync } from '@valenced/modules/native'
import { getErrorStack } from '@valenced/utils/error'
import { isAndroid } from '../../../shared/platform'
import type { Settings } from './types'

export { isAndroid }

interface PluginInstance {
	reportError(error: unknown): void
}

let pluginInstance: PluginInstance | undefined

export function setNativeLogger(plugin: PluginInstance) {
	pluginInstance = plugin
}

export function syncNative(settings: Settings) {
	if (!isAndroid) return
	try {
		callNativeMethodSync('hieuxyz.expandreplies.setLimits', [
			settings.maxLines,
			settings.preserveNewlines,
			settings.alignWithLine1,
		])
	} catch (e) {
		pluginInstance?.reportError(
			`Failed to sync limits to native: ${getErrorStack(e)}`,
		)
	}
}

declare module '@valenced/modules/native' {
	interface NativeMethods {
		'hieuxyz.expandreplies.setLimits': [
			[maxLines: number, allowNewlines: boolean, alignWithLine1: boolean],
			null,
		]
	}
}
