import {
	SearchInput,
	SheetHeader,
	TableRowAssetIcon,
} from '@valenced/components'
import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
	ActivityIndicator,
	FlatList,
	StyleSheet,
	Vibration,
	View,
} from 'react-native'
import {
	fetchDiscoverableGuilds,
	isGuildJoined,
	joinGuild,
	searchDiscoverableGuilds,
	selectGuild,
} from '../api/discoveryApi'
import { MODAL_KEY_DISCOVERY, MODAL_KEY_PREVIEW } from '../constants'
import { DefaultSettings } from '../types'
import { useThemeTokens } from '../utils/theme'
import { showToast } from '../utils/toast'
import { CategoryBar } from './CategoryBar'
import { ServerCard } from './ServerCard'
import { ServerPreviewContent } from './ServerPreviewModal'
import type { ListRenderItemInfo } from 'react-native'
import type {
	DiscoverableGuild,
	DiscoverableGuildsResponse,
	Settings,
} from '../types'

function extractInputText(val: unknown): string {
	if (typeof val === 'string') return val
	if (val && typeof val === 'object') {
		const obj = val as Record<string, unknown>
		if (typeof obj.text === 'string') return obj.text
		if (typeof obj.value === 'string') return obj.value
		if (obj.nativeEvent && typeof obj.nativeEvent === 'object') {
			const ne = obj.nativeEvent as Record<string, unknown>
			if (typeof ne.text === 'string') return ne.text
		}
	}
	return ''
}

interface ServerPreviewSheetProps {
	guild: DiscoverableGuild
	isJoined: boolean
	isJoining?: boolean
	onJoin: (guild: DiscoverableGuild) => void
	onView: (guild: DiscoverableGuild) => void
	onClose: () => void
}

function ServerPreviewSheet(props: ServerPreviewSheetProps) {
	return <ServerPreviewContent {...props} />
}

interface ServerDiscoveryViewProps {
	isModal?: boolean
	onClose?: () => void
	settings?: Settings
}

export function ServerDiscoveryView({
	isModal = false,
	onClose,
	settings = DefaultSettings,
}: ServerDiscoveryViewProps) {
	const { Button, Text } = Design
	const tokens = useThemeTokens()

	const [searchQuery, setSearchQuery] = useState('')
	const [selectedCategoryId, setSelectedCategoryId] = useState(
		settings.defaultCategory ?? 0,
	)
	const [guilds, setGuilds] = useState<DiscoverableGuild[]>([])
	const [loading, setLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [hasMorePages, setHasMorePages] = useState(true)
	const [total, setTotal] = useState<number | undefined>(undefined)
	const [offset, setOffset] = useState(0)
	const [joiningId, setJoiningId] = useState<string | null>(null)
	const [joinedSet, setJoinedSet] = useState<Set<string>>(new Set())

	const isMountedRef = useRef(true)
	const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	)
	const currentRequestRef = useRef(0)
	const selectedCategoryIdRef = useRef(selectedCategoryId)
	selectedCategoryIdRef.current = selectedCategoryId

	const limit = settings.resultsPerPage ?? 24

	const loadGuilds = useCallback(
		async (
			query: string,
			categoryId: number,
			targetOffset = 0,
			isAppend = false,
		) => {
			const reqId = ++currentRequestRef.current
			if (isAppend) {
				setLoadingMore(true)
			} else {
				setLoading(true)
			}

			try {
				let result: DiscoverableGuildsResponse
				if (query.trim().length > 0) {
					result = await searchDiscoverableGuilds({
						query: query.trim(),
						categoryId: categoryId > 0 ? categoryId : undefined,
						offset: targetOffset,
						limit,
					})
				} else {
					result = await fetchDiscoverableGuilds({
						categoryId: categoryId > 0 ? categoryId : undefined,
						offset: targetOffset,
						limit,
					})
				}

				if (reqId !== currentRequestRef.current || !isMountedRef.current) return

				const newGuilds = result.guilds || []
				setHasMorePages(newGuilds.length >= limit)

				if (isAppend) {
					setGuilds(prev => {
						const existingIds = new Set(prev.map(g => g.id))
						const uniqueNew = newGuilds.filter(g => !existingIds.has(g.id))
						return [...prev, ...uniqueNew]
					})
				} else {
					setGuilds(newGuilds)
				}

				setTotal(result.total ?? result.total_count)
				setOffset(targetOffset)

				setJoinedSet(prev => {
					const next = new Set(prev)
					for (const g of newGuilds) {
						if (isGuildJoined(g.id)) {
							next.add(g.id)
						}
					}
					return next
				})
			} catch (err: unknown) {
				if (reqId === currentRequestRef.current && isMountedRef.current) {
					const message = (err as Error)?.message ?? 'Failed to load servers'
					showToast(message)
				}
			} finally {
				if (reqId === currentRequestRef.current && isMountedRef.current) {
					setLoading(false)
					setLoadingMore(false)
				}
			}
		},
		[limit],
	)

	useEffect(() => {
		isMountedRef.current = true
		void loadGuilds('', selectedCategoryId, 0, false)
		return () => {
			isMountedRef.current = false
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current)
			}
		}
	}, [loadGuilds, selectedCategoryId])

	const handleQueryChange = (val: unknown) => {
		const text = extractInputText(val)
		setSearchQuery(text)
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current)
		}
		searchTimeoutRef.current = setTimeout(() => {
			if (isMountedRef.current) {
				void loadGuilds(text, selectedCategoryIdRef.current, 0, false)
			}
		}, 350)
	}

	const handleCategorySelect = (categoryId: number) => {
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current)
		}
		setSelectedCategoryId(categoryId)
		selectedCategoryIdRef.current = categoryId
		void loadGuilds(searchQuery, categoryId, 0, false)
	}

	const handleLoadMore = () => {
		if (loading || loadingMore || !hasMorePages) return
		const nextOffset = offset + limit
		void loadGuilds(searchQuery, selectedCategoryId, nextOffset, true)
	}

	const handleJoin = async (guild: DiscoverableGuild) => {
		setJoiningId(guild.id)
		try {
			await joinGuild(guild.id)
			Vibration.vibrate(50)
			setJoinedSet(prev => new Set(prev).add(guild.id))
			showToast(`Joined ${guild.name}!`)
			selectGuild(guild.id)
			try {
				ActionSheetActionCreators.hideActionSheet(MODAL_KEY_PREVIEW)
			} catch {}
			if (onClose) {
				onClose()
			} else {
				try {
					ActionSheetActionCreators.hideActionSheet(MODAL_KEY_DISCOVERY)
				} catch {}
			}
		} catch (err: unknown) {
			const message = (err as Error)?.message ?? 'Failed to join server'
			showToast(message)
		} finally {
			if (isMountedRef.current) {
				setJoiningId(null)
			}
		}
	}

	const handleView = (guild: DiscoverableGuild) => {
		selectGuild(guild.id)
		try {
			ActionSheetActionCreators.hideActionSheet(MODAL_KEY_PREVIEW)
		} catch {}
		if (onClose) {
			onClose()
		} else {
			try {
				ActionSheetActionCreators.hideActionSheet(MODAL_KEY_DISCOVERY)
			} catch {}
		}
	}

	const handlePreview = (guild: DiscoverableGuild) => {
		ActionSheetActionCreators.openLazy(
			Promise.resolve({
				default: ServerPreviewSheet,
			}),
			MODAL_KEY_PREVIEW,
			{
				guild,
				isJoined: joinedSet.has(guild.id),
				isJoining: joiningId === guild.id,
				onJoin: handleJoin,
				onView: handleView,
				onClose: () =>
					ActionSheetActionCreators.hideActionSheet(MODAL_KEY_PREVIEW),
			},
			'stack',
		)
	}

	const hasMore =
		guilds.length > 0 &&
		hasMorePages &&
		(total === undefined || guilds.length < total)

	const renderGuildItem = useCallback(
		({ item }: ListRenderItemInfo<DiscoverableGuild>) => (
			<ServerCard
				guild={item}
				isJoined={joinedSet.has(item.id)}
				isJoining={joiningId === item.id}
				onJoin={handleJoin}
				onView={handleView}
				onPreview={handlePreview}
			/>
		),
		[joinedSet, joiningId],
	)

	const renderEmptyComponent = () => {
		if (loading) {
			return (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={tokens.textBrand} />
					<Text
						variant="text-sm/normal"
						color="text-muted"
						style={[styles.loadingText, { color: tokens.textMuted }]}
					>
						Discovering communities...
					</Text>
				</View>
			)
		}

		return (
			<View style={styles.emptyContainer}>
				<View
					style={[
						styles.emptyIconWrapper,
						{ backgroundColor: tokens.backgroundModifierAccent },
					]}
				>
					<TableRowAssetIcon name="CompassIcon" />
				</View>
				<Text
					variant="heading-md/bold"
					color="text-strong"
					style={[styles.emptyTitle, { color: tokens.textStrong }]}
				>
					No servers found
				</Text>
				<Text
					variant="text-sm/normal"
					color="text-muted"
					style={[styles.emptySubtitle, { color: tokens.textMuted }]}
				>
					{searchQuery
						? `No communities matching "${searchQuery}". Try different keywords or categories.`
						: 'No servers currently available in this category.'}
				</Text>
				{searchQuery ? (
					<Button
						size="sm"
						variant="secondary"
						text="Clear Search"
						onPress={() => handleQueryChange('')}
						style={styles.clearBtn}
					/>
				) : null}
			</View>
		)
	}

	const renderFooterComponent = () => {
		if (loading || guilds.length === 0) return null
		if (!hasMore) return null

		return (
			<View style={styles.footerContainer}>
				{loadingMore ? (
					<View style={styles.footerLoading}>
						<ActivityIndicator size="small" color={tokens.textBrand} />
						<Text
							variant="text-xs/normal"
							color="text-muted"
							style={[styles.footerLoadingText, { color: tokens.textMuted }]}
						>
							Loading more servers...
						</Text>
					</View>
				) : (
					<Button
						variant="secondary"
						text="Load More Communities"
						onPress={handleLoadMore}
					/>
				)}
			</View>
		)
	}

	return (
		<View style={styles.container}>
			{isModal && (
				<SheetHeader
					title="Server Discovery"
					action={
						<Button
							size="sm"
							variant="tertiary"
							text="Close"
							onPress={
								onClose ?? (() => ActionSheetActionCreators.hideActionSheet())
							}
						/>
					}
				/>
			)}

			<View style={styles.searchRow}>
				<SearchInput
					placeholder="Search public servers..."
					value={searchQuery}
					onChange={handleQueryChange}
					isClearable
					clearable
					onClear={() => handleQueryChange('')}
				/>
			</View>

			<CategoryBar
				selectedCategoryId={selectedCategoryId}
				onSelectCategory={handleCategorySelect}
			/>

			<FlatList
				data={guilds}
				renderItem={renderGuildItem}
				keyExtractor={item => item.id}
				ListEmptyComponent={renderEmptyComponent}
				ListFooterComponent={renderFooterComponent}
				onEndReached={handleLoadMore}
				onEndReachedThreshold={0.5}
				windowSize={7}
				initialNumToRender={8}
				maxToRenderPerBatch={8}
				showsVerticalScrollIndicator={false}
				style={styles.list}
				contentContainerStyle={styles.listContent}
				nestedScrollEnabled={true}
				keyboardShouldPersistTaps="handled"
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	searchRow: {
		paddingHorizontal: 16,
		paddingTop: 8,
		paddingBottom: 4,
	},
	list: {
		flex: 1,
	},
	listContent: {
		paddingHorizontal: 16,
		paddingBottom: 36,
		flexGrow: 1,
	},
	loadingContainer: {
		paddingVertical: 64,
		alignItems: 'center',
		justifyContent: 'center',
	},
	loadingText: {
		marginTop: 12,
	},
	emptyContainer: {
		paddingVertical: 48,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 24,
	},
	emptyIconWrapper: {
		width: 56,
		height: 56,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 16,
	},
	emptyTitle: {
		marginBottom: 6,
		textAlign: 'center',
	},
	emptySubtitle: {
		textAlign: 'center',
		lineHeight: 18,
		marginBottom: 16,
	},
	clearBtn: {
		marginTop: 8,
	},
	footerContainer: {
		paddingVertical: 16,
	},
	footerLoading: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 8,
		gap: 8,
	},
	footerLoadingText: {
		letterSpacing: 0.2,
	},
})
