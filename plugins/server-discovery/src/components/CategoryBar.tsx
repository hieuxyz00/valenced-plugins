import { Design } from '@valenced/discord/design'
import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { useEffect, useState } from 'react'
import * as ReactNative from 'react-native'
import {
	fetchDiscoveryCategories,
	getCachedDiscoveryCategories,
} from '../api/discoveryApi'
import { useThemeTokens } from '../utils/theme'
import type { ComponentType } from 'react'
import type { DiscoveryCategory } from '../types'

const { Pressable, StyleSheet, View } = ReactNative

interface GestureHandlerModule {
	PanGestureHandler?: unknown
	GestureHandlerRootView?: unknown
	ScrollView?: ComponentType<
		ReactNative.ScrollViewProps & {
			disallowInterruption?: boolean
		}
	>
	default?: {
		ScrollView?: ComponentType<
			ReactNative.ScrollViewProps & {
				disallowInterruption?: boolean
			}
		>
	}
}

let cachedGestureScrollView:
	| ComponentType<
			ReactNative.ScrollViewProps & {
				disallowInterruption?: boolean
			}
	  >
	| undefined

export function getGestureScrollView(): ComponentType<
	ReactNative.ScrollViewProps & {
		disallowInterruption?: boolean
	}
> {
	if (cachedGestureScrollView) {
		return cachedGestureScrollView
	}
	try {
		const valencedObj = (globalThis as unknown as Record<string, unknown>)
			.valenced as
			| {
					externals?: {
						RNGH?: GestureHandlerModule
						ReactNativeGestureHandler?: GestureHandlerModule
					}
			  }
			| undefined

		const externalScrollView =
			valencedObj?.externals?.RNGH?.ScrollView ??
			valencedObj?.externals?.RNGH?.default?.ScrollView ??
			valencedObj?.externals?.ReactNativeGestureHandler?.ScrollView ??
			valencedObj?.externals?.ReactNativeGestureHandler?.default?.ScrollView

		if (externalScrollView) {
			cachedGestureScrollView = externalScrollView
			return cachedGestureScrollView
		}

		let [module] = lookupModule(
			withProps<GestureHandlerModule>('PanGestureHandler', 'ScrollView'),
		)
		if (!module) {
			;[module] = lookupModule(
				withProps<GestureHandlerModule>(
					'GestureHandlerRootView',
					'PanGestureHandler',
				),
			)
		}
		const foundScrollView = module?.ScrollView ?? module?.default?.ScrollView
		if (foundScrollView) {
			cachedGestureScrollView = foundScrollView
			return cachedGestureScrollView
		}
	} catch {}
	return ReactNative.ScrollView
}

export function resetGestureScrollView(): void {
	cachedGestureScrollView = undefined
}

interface CategoryBarProps {
	categories?: readonly DiscoveryCategory[]
	selectedCategoryId: number
	onSelectCategory: (categoryId: number) => void
}

export function CategoryBar({
	categories: propCategories,
	selectedCategoryId,
	onSelectCategory,
}: CategoryBarProps) {
	const { Text } = Design
	const tokens = useThemeTokens()
	const GestureScrollView = getGestureScrollView()

	const [categories, setCategories] = useState<readonly DiscoveryCategory[]>(
		() => propCategories ?? getCachedDiscoveryCategories() ?? [],
	)

	useEffect(() => {
		if (propCategories) {
			setCategories(propCategories)
			return
		}

		let isMounted = true
		void fetchDiscoveryCategories().then(cats => {
			if (isMounted && cats && cats.length > 0) {
				setCategories(cats)
			}
		})
		return () => {
			isMounted = false
		}
	}, [propCategories])

	if (categories.length === 0) {
		return null
	}

	return (
		<View style={styles.container}>
			<GestureScrollView
				horizontal
				disallowInterruption={true}
				nestedScrollEnabled={true}
				keyboardShouldPersistTaps="handled"
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.scrollContent}
			>
				{categories.map(cat => {
					const isSelected = cat.id === selectedCategoryId
					return (
						<Pressable
							key={`cat-${cat.id}`}
							onPress={() => onSelectCategory(Number(cat.id))}
							hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
							style={({ pressed }) => [
								styles.chip,
								{ backgroundColor: tokens.backgroundModifierAccent },
								isSelected && [
									styles.chipSelected,
									{
										backgroundColor: tokens.backgroundModifierSelected,
										borderColor: tokens.textBrand,
									},
								],
								pressed && styles.chipPressed,
							]}
						>
							<Text
								variant="text-sm/medium"
								color={isSelected ? 'text-brand' : 'text-muted'}
								style={[
									styles.label,
									{ color: isSelected ? tokens.textBrand : tokens.textMuted },
								]}
							>
								{cat.name}
							</Text>
						</Pressable>
					)
				})}
			</GestureScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		paddingVertical: 8,
	},
	scrollContent: {
		paddingHorizontal: 16,
		gap: 8,
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	chipSelected: {
		borderWidth: 1,
	},
	chipPressed: {
		opacity: 0.75,
	},
	label: {
		letterSpacing: 0.2,
	},
})
