import { getAssetIdByName, getAssets } from '@valenced/assets'
import { Design } from '@valenced/discord/design'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Image, Pressable, ScrollView, View } from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

const { Text, TextInput } = Design

export interface EmojiPickerProps {
	currentIcon?: string
	onSelect: (icon: string) => void
}

function generateEmojiRange(start: number, end: number): string[] {
	const list: string[] = []
	for (let cp = start; cp <= end; cp++) {
		list.push(String.fromCodePoint(cp))
	}
	return list
}

const CATEGORY_DEFINITIONS: ReadonlyArray<{
	name: string
	ranges: readonly (readonly [number, number])[]
}> = [
	{
		name: 'Smileys & Emotion',
		ranges: [
			[0x1f600, 0x1f64f],
			[0x1f910, 0x1f92f],
			[0x1f970, 0x1f978],
			[0x1f97a, 0x1f984],
			[0x1f479, 0x1f480],
			[0x1f4a1, 0x1f4af],
			[0x1f48b, 0x1f49f],
		],
	},
	{
		name: 'People & Body',
		ranges: [
			[0x1f440, 0x1f450],
			[0x1f466, 0x1f478],
			[0x1f481, 0x1f48f],
			[0x1f4aa, 0x1f4bb],
			[0x1f645, 0x1f64f],
			[0x1f90c, 0x1f93f],
			[0x1f9b0, 0x1f9bf],
			[0x1f9d1, 0x1f9df],
		],
	},
	{
		name: 'Animals & Nature',
		ranges: [
			[0x1f400, 0x1f43f],
			[0x1f980, 0x1f9ae],
			[0x1f330, 0x1f353],
			[0x1f300, 0x1f320],
			[0x1f337, 0x1f350],
			[0x1fab0, 0x1fabf],
		],
	},
	{
		name: 'Food & Drink',
		ranges: [
			[0x1f345, 0x1f37f],
			[0x1f950, 0x1f96f],
			[0x1f9c0, 0x1f9cb],
			[0x1fad0, 0x1fad9],
		],
	},
	{
		name: 'Activities & Sports',
		ranges: [
			[0x1f3a0, 0x1f3d3],
			[0x1f938, 0x1f94f],
			[0x1f6a3, 0x1f6b4],
			[0x1f380, 0x1f393],
		],
	},
	{
		name: 'Travel & Places',
		ranges: [
			[0x1f680, 0x1f6c5],
			[0x1f3d4, 0x1f3fa],
			[0x1f6eb, 0x1f6f3],
			[0x1f6f4, 0x1f6fa],
		],
	},
	{
		name: 'Objects & Tech',
		ranges: [
			[0x1f4bb, 0x1f4ef],
			[0x1f500, 0x1f53d],
			[0x1f5a5, 0x1f5d3],
			[0x1f6e0, 0x1f6ea],
			[0x1fa90, 0x1faa8],
		],
	},
	{
		name: 'Symbols & Hearts',
		ranges: [
			[0x2700, 0x27bf],
			[0x1f9e1, 0x1f9ff],
			[0x1fa70, 0x1fa9f],
			[0x1f500, 0x1f54f],
			[0x1f1e6, 0x1f1ff],
		],
	},
]

export const EMOJI_CATEGORIES: ReadonlyArray<{
	name: string
	emojis: readonly string[]
}> = CATEGORY_DEFINITIONS.map(cat => ({
	name: cat.name,
	emojis: Object.freeze(
		cat.ranges.flatMap(([start, end]) => generateEmojiRange(start, end)),
	),
}))

export const DEFAULT_DISCORD_ICONS: readonly string[] = [
	'CrownIcon',
	'ShieldUserIcon',
	'ShieldIcon',
	'WrenchIcon',
	'StaffBadgeIcon',
	'StarIcon',
	'HammerIcon',
	'CheckmarkSmallIcon',
	'RobotIcon',
	'SparklesIcon',
	'LockIcon',
	'ChatIcon',
	'HeartIcon',
	'GearIcon',
	'SettingsIcon',
	'FireIcon',
	'BellIcon',
	'CompassIcon',
	'UserIcon',
	'UserPlusIcon',
	'HomeIcon',
	'InboxIcon',
	'HelpIcon',
	'InfoIcon',
	'BookCheckIcon',
	'CheckmarkLargeIcon',
	'XLargeIcon',
	'PencilIcon',
	'TrashIcon',
	'EyeIcon',
	'EyeSlashIcon',
	'LinkIcon',
	'PinIcon',
	'FlagIcon',
	'GiftIcon',
	'GameControllerIcon',
	'CameraIcon',
	'MicrophoneIcon',
	'HeadphonesIcon',
	'VolumeUpIcon',
]

export type PickerItem =
	| { type: 'icon'; value: string; assetId?: number }
	| { type: 'emoji'; value: string }

const PREBUILT_CATEGORY_MAP = new Map<string, readonly PickerItem[]>()
const PREBUILT_ALL_EMOJIS: PickerItem[] = []

for (const cat of EMOJI_CATEGORIES) {
	const catItems: PickerItem[] = cat.emojis.map(e =>
		Object.freeze({ type: 'emoji' as const, value: e }),
	)
	PREBUILT_CATEGORY_MAP.set(cat.name, Object.freeze(catItems))
	PREBUILT_ALL_EMOJIS.push(...catItems)
}
Object.freeze(PREBUILT_ALL_EMOJIS)

const ITEM_SIZE = 38
const ITEM_GAP = 6
const ROW_HEIGHT = ITEM_SIZE + ITEM_GAP
const OVERSCAN_ROWS = 3

/**
 * High-performance virtualized Emoji & Icon Picker.
 * Uses Discord Design.TextInput and Design.Text.
 */
export function EmojiPicker({ currentIcon, onSelect }: EmojiPickerProps) {
	const [query, setQuery] = useState('')
	const [activeCategory, setActiveCategory] = useState<string>('All')
	const [scrollY, setScrollY] = useState(0)
	const [containerWidth, setContainerWidth] = useState(320)
	const [viewportHeight, setViewportHeight] = useState(360)
	const scrollViewRef = useRef<ScrollView>(null)

	const safeQuery = query.trim().toLowerCase()

	const handleCategoryChange = useCallback((cat: string) => {
		setActiveCategory(cat)
		setScrollY(0)
		scrollViewRef.current?.scrollTo({ y: 0, animated: false })
	}, [])

	const handleQueryChange = useCallback((val: string) => {
		setQuery(val)
		setScrollY(0)
		scrollViewRef.current?.scrollTo({ y: 0, animated: false })
	}, [])

	const discordIcons = useMemo(() => {
		const list: PickerItem[] = []
		const seen = new Set<string>()
		for (const def of DEFAULT_DISCORD_ICONS) {
			seen.add(def)
			list.push({
				type: 'icon',
				value: def,
				assetId: getAssetIdByName(def),
			})
		}
		try {
			const assets = typeof getAssets === 'function' ? getAssets() : []
			for (const asset of assets ?? []) {
				if (
					typeof asset?.name === 'string' &&
					asset.name.length > 0 &&
					!seen.has(asset.name)
				) {
					if (
						asset.name.endsWith('Icon') ||
						asset.name.includes('Icon') ||
						asset.type === 'png' ||
						asset.type === 'svg'
					) {
						seen.add(asset.name)
						list.push({
							type: 'icon',
							value: asset.name,
							assetId: asset.id ?? getAssetIdByName(asset.name),
						})
					}
				}
			}
		} catch {}
		return list.sort((a, b) => a.value.localeCompare(b.value))
	}, [])

	const allMixedItems = useMemo<readonly PickerItem[]>(() => {
		const mixed: PickerItem[] = []
		let i = 0
		let j = 0
		while (i < discordIcons.length || j < PREBUILT_ALL_EMOJIS.length) {
			if (i < discordIcons.length) {
				mixed.push(discordIcons[i++])
			}
			for (let k = 0; k < 4 && j < PREBUILT_ALL_EMOJIS.length; k++) {
				mixed.push(PREBUILT_ALL_EMOJIS[j++])
			}
		}
		return Object.freeze(mixed)
	}, [discordIcons])

	const filteredItems = useMemo<readonly PickerItem[]>(() => {
		let pool: readonly PickerItem[]
		if (activeCategory === 'All') {
			pool = allMixedItems
		} else if (activeCategory === 'Discord Icons') {
			pool = discordIcons
		} else {
			pool = PREBUILT_CATEGORY_MAP.get(activeCategory) ?? PREBUILT_ALL_EMOJIS
		}

		if (!safeQuery) return pool

		return pool.filter(item => {
			if (item.type === 'icon') {
				return item.value.toLowerCase().includes(safeQuery)
			}
			return item.value.includes(safeQuery)
		})
	}, [activeCategory, allMixedItems, discordIcons, safeQuery])

	const categories = useMemo(() => {
		return ['All', 'Discord Icons', ...CATEGORY_DEFINITIONS.map(c => c.name)]
	}, [])

	const itemsPerRow = Math.max(4, Math.floor(containerWidth / ROW_HEIGHT))
	const totalRows = Math.ceil(filteredItems.length / itemsPerRow)

	const safeViewportHeight = Math.max(450, viewportHeight)
	const startRowIndex = Math.max(
		0,
		Math.floor(scrollY / ROW_HEIGHT) - OVERSCAN_ROWS,
	)
	const visibleRowCount =
		Math.ceil(safeViewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2
	const endRowIndex = Math.min(totalRows, startRowIndex + visibleRowCount)

	const visibleRows = useMemo(() => {
		const rows: PickerItem[][] = []
		for (let r = startRowIndex; r < endRowIndex; r++) {
			const startIdx = r * itemsPerRow
			const row = filteredItems.slice(startIdx, startIdx + itemsPerRow)
			if (row.length > 0) rows.push(row)
		}
		return rows
	}, [filteredItems, startRowIndex, endRowIndex, itemsPerRow])

	const topSpacerHeight = startRowIndex * ROW_HEIGHT
	const bottomSpacerHeight = Math.max(0, (totalRows - endRowIndex) * ROW_HEIGHT)

	const handleScroll = useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
			setScrollY(event.nativeEvent.contentOffset.y)
		},
		[],
	)

	return (
		<View
			style={{ flex: 1 }}
			onLayout={e => {
				const { width, height } = e.nativeEvent.layout
				if (width > 0) setContainerWidth(width)
				if (height > 0) setViewportHeight(height)
			}}
		>
			{/* Pinned Search Input */}
			<View style={{ marginBottom: 8 }}>
				<TextInput
					label="Search Icons or Emojis"
					placeholder="Search e.g. CrownIcon, Fire, Heart..."
					value={query}
					onChange={handleQueryChange}
				/>
			</View>

			{/* Category Selector Tabs */}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={{ flexGrow: 0, marginBottom: 10 }}
				contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
				keyboardShouldPersistTaps="always"
			>
				{categories.map(cat => {
					const isSel = activeCategory === cat
					return (
						<Pressable
							key={cat}
							hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
							onPress={() => handleCategoryChange(cat)}
							style={({ pressed }) => ({
								paddingHorizontal: 12,
								paddingVertical: 6,
								borderRadius: 8,
								backgroundColor: isSel
									? '#5865F2'
									: pressed
										? 'rgba(255, 255, 255, 0.16)'
										: 'rgba(255, 255, 255, 0.08)',
								opacity: pressed ? 0.8 : 1,
								transform: [{ scale: pressed ? 0.94 : 1 }],
							})}
						>
							<Text
								variant="text-xs/bold"
								style={{ color: isSel ? '#FFFFFF' : '#949BA4' }}
							>
								{cat}
							</Text>
						</Pressable>
					)
				})}
			</ScrollView>

			{/* Count Header */}
			<Text
				variant="text-xs/bold"
				color="header-secondary"
				style={{ marginBottom: 6, textTransform: 'uppercase' }}
			>
				{activeCategory} ({filteredItems.length} items)
			</Text>

			{/* Virtualized Sliding Window Grid */}
			<ScrollView
				ref={scrollViewRef}
				style={{ flex: 1 }}
				contentContainerStyle={{
					paddingBottom: 24,
				}}
				nestedScrollEnabled
				keyboardShouldPersistTaps="always"
				scrollEventThrottle={16}
				onScroll={handleScroll}
			>
				{topSpacerHeight > 0 ? (
					<View style={{ height: topSpacerHeight }} />
				) : null}

				{visibleRows.map((rowItems, rIdx) => {
					const rowIndex = startRowIndex + rIdx
					return (
						<View
							key={`row-${rowIndex}`}
							style={{
								height: ROW_HEIGHT,
								flexDirection: 'row',
								gap: ITEM_GAP,
								alignItems: 'center',
							}}
						>
							{rowItems.map(item => {
								const isSel = currentIcon === item.value

								if (item.type === 'icon') {
									return (
										<Pressable
											key={`icon-${item.value}`}
											hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
											onPress={() => onSelect(item.value)}
											style={({ pressed }) => ({
												width: ITEM_SIZE,
												height: ITEM_SIZE,
												borderRadius: 8,
												backgroundColor: isSel
													? '#5865F2'
													: pressed
														? 'rgba(255, 255, 255, 0.18)'
														: 'rgba(255, 255, 255, 0.06)',
												justifyContent: 'center',
												alignItems: 'center',
												borderWidth: isSel ? 2 : 1,
												borderColor: isSel
													? '#FFFFFF'
													: 'rgba(255, 255, 255, 0.1)',
												transform: [{ scale: pressed ? 0.88 : 1 }],
											})}
										>
											{item.assetId !== undefined ? (
												<Image
													source={item.assetId}
													style={{
														width: 20,
														height: 20,
														tintColor: isSel ? '#FFFFFF' : '#DBDEE1',
													}}
												/>
											) : (
												<Text style={{ fontSize: 16 }}>🏷️</Text>
											)}
										</Pressable>
									)
								}

								return (
									<Pressable
										key={`emoji-${item.value}`}
										hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
										onPress={() => onSelect(item.value)}
										style={({ pressed }) => ({
											width: ITEM_SIZE,
											height: ITEM_SIZE,
											borderRadius: 8,
											backgroundColor: isSel
												? '#5865F2'
												: pressed
													? 'rgba(255, 255, 255, 0.18)'
													: 'rgba(255, 255, 255, 0.06)',
											justifyContent: 'center',
											alignItems: 'center',
											borderWidth: isSel ? 2 : 1,
											borderColor: isSel
												? '#FFFFFF'
												: 'rgba(255, 255, 255, 0.1)',
											transform: [{ scale: pressed ? 0.88 : 1 }],
										})}
									>
										<Text style={{ fontSize: 20 }}>{item.value}</Text>
									</Pressable>
								)
							})}
						</View>
					)
				})}

				{bottomSpacerHeight > 0 ? (
					<View style={{ height: bottomSpacerHeight }} />
				) : null}
			</ScrollView>
		</View>
	)
}
