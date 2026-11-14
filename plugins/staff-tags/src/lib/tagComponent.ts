import { getModules, lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import type { TagModule } from '../types'

let cachedTagModule: TagModule | undefined

export function getTagModule(): TagModule | undefined {
	if (!cachedTagModule) {
		const [found] = lookupModule(withProps<TagModule>('getBotLabel'))
		if (found) {
			cachedTagModule = found
		}
	}
	return cachedTagModule
}

export function initTagModule(): () => void {
	return getModules(withProps<TagModule>('getBotLabel'), mod => {
		cachedTagModule = mod
	})
}
