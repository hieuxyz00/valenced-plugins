import { Design } from '@valenced/discord/design'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { useEffect, useState } from 'react'
import { Dimensions, Image, ScrollView, StyleSheet, View } from 'react-native'
import { fetchGuildPreview } from '../api/discoveryApi'
import {
	formatCount,
	getFeatureLabel,
	getGuildBannerUrl,
	getGuildIconUrl,
} from '../utils/format'
import { useThemeTokens } from '../utils/theme'
import type { DiscoverableGuild, GuildPreview } from '../types'

function getCircleCheckIcon() {
	return lookupGeneratedIconComponent('CircleCheckIcon')
}

function getShieldIcon() {
	return lookupGeneratedIconComponent('ShieldIcon')
}

interface ServerPreviewContentProps {
	guild: DiscoverableGuild
	isJoined: boolean
	isJoining?: boolean
	onJoin: (guild: DiscoverableGuild) => void
	onView: (guild: DiscoverableGuild) => void
	onClose: () => void
}

export function ServerPreviewContent({
	guild,
	isJoined,
	isJoining = false,
	onJoin,
	onView,
	onClose,
}: ServerPreviewContentProps) {
	const { ActionSheet, Button, Text } = Design
	const tokens = useThemeTokens()

	const CircleCheckIcon = getCircleCheckIcon()
	const ShieldIcon = getShieldIcon()

	const [preview, setPreview] = useState<GuildPreview | null>(null)

	useEffect(() => {
		let isMounted = true
		fetchGuildPreview(guild.id)
			.then(res => {
				if (isMounted && res) {
					setPreview(res)
				}
			})
			.catch(() => {})
		return () => {
			isMounted = false
		}
	}, [guild.id])

	const displayGuild = preview ?? guild
	const bannerUrl = getGuildBannerUrl(displayGuild, 600)
	const iconUrl = getGuildIconUrl(guild.id, displayGuild.icon, 128)
	const isVerified = displayGuild.features?.includes('VERIFIED')
	const isPartnered = displayGuild.features?.includes('PARTNERED')
	const initialLetter =
		(displayGuild.name ?? guild.name ?? '').trim().charAt(0).toUpperCase() ||
		'?'

	const emojis = preview?.emojis?.slice(0, 16) ?? []
	const displayFeatures = (displayGuild.features ?? [])
		.filter(
			f =>
				![
					'DISCOVERABLE',
					'COMMUNITY',
					'VERIFIED',
					'PARTNERED',
					'FEATURABLE',
					'ENABLED_DISCOVERABLE_BEFORE',
					'CONSIDERED_EXTERNALLY_DISCOVERABLE',
				].includes(f),
		)
		.slice(0, 8)

	return (
		<ActionSheet>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.scrollContainer}
				style={styles.sheetContent}
				nestedScrollEnabled={true}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.bannerContainer}>
					{bannerUrl ? (
						<Image
							source={{ uri: bannerUrl }}
							style={styles.bannerImage}
							resizeMode="cover"
						/>
					) : (
						<View
							style={[
								styles.bannerFallback,
								{ backgroundColor: tokens.backgroundSecondaryAlt },
							]}
						/>
					)}
					<View style={styles.bannerOverlay} />
				</View>

				<View style={styles.content}>
					<View style={styles.avatarRow}>
						<View
							style={[
								styles.iconContainer,
								{
									borderColor: tokens.backgroundTertiary,
									backgroundColor: tokens.backgroundSecondary,
								},
							]}
						>
							{iconUrl ? (
								<Image
									source={{ uri: iconUrl }}
									style={styles.iconImage}
									resizeMode="cover"
								/>
							) : (
								<View
									style={[
										styles.iconFallback,
										{ backgroundColor: tokens.textBrand },
									]}
								>
									<Text
										variant="heading-lg/bold"
										color="text-strong"
										style={{ color: tokens.textStrong }}
									>
										{initialLetter}
									</Text>
								</View>
							)}
						</View>
					</View>

					<View style={styles.titleRow}>
						<Text
							variant="heading-md/bold"
							color="text-strong"
							style={[styles.titleText, { color: tokens.textStrong }]}
						>
							{displayGuild.name}
						</Text>
						{isVerified && CircleCheckIcon ? (
							<View style={styles.badgeWrapper}>
								<CircleCheckIcon color={tokens.statusPositive} size="md" />
							</View>
						) : null}
						{isPartnered && ShieldIcon ? (
							<View style={styles.badgeWrapper}>
								<ShieldIcon color={tokens.textBrand} size="md" />
							</View>
						) : null}
					</View>

					<View
						style={[
							styles.statsContainer,
							{ backgroundColor: tokens.backgroundModifierAccent },
						]}
					>
						<View style={styles.statBox}>
							<View
								style={[
									styles.onlineDot,
									{ backgroundColor: tokens.statusOnline },
								]}
							/>
							<Text
								variant="text-sm/semibold"
								color="text-strong"
								style={{ color: tokens.textStrong }}
							>
								{formatCount(displayGuild.approximate_presence_count)}
							</Text>
							<Text
								variant="text-xs/normal"
								color="text-muted"
								style={{ color: tokens.textMuted }}
							>
								Online
							</Text>
						</View>
						<View
							style={[
								styles.statDivider,
								{ backgroundColor: tokens.borderSubtle },
							]}
						/>
						<View style={styles.statBox}>
							<View
								style={[
									styles.memberDot,
									{ backgroundColor: tokens.iconMuted },
								]}
							/>
							<Text
								variant="text-sm/semibold"
								color="text-strong"
								style={{ color: tokens.textStrong }}
							>
								{formatCount(displayGuild.approximate_member_count)}
							</Text>
							<Text
								variant="text-xs/normal"
								color="text-muted"
								style={{ color: tokens.textMuted }}
							>
								Members
							</Text>
						</View>
					</View>

					{displayGuild.description ? (
						<View style={styles.section}>
							<Text
								variant="text-xs/semibold"
								color="text-muted"
								style={[styles.sectionTitle, { color: tokens.textMuted }]}
							>
								ABOUT THIS SERVER
							</Text>
							<Text
								variant="text-sm/normal"
								color="text-default"
								style={[styles.descriptionText, { color: tokens.textDefault }]}
							>
								{displayGuild.description}
							</Text>
						</View>
					) : null}

					{emojis.length > 0 ? (
						<View style={styles.section}>
							<Text
								variant="text-xs/semibold"
								color="text-muted"
								style={[styles.sectionTitle, { color: tokens.textMuted }]}
							>
								CUSTOM EMOJIS ({preview?.emojis?.length ?? emojis.length})
							</Text>
							<View style={styles.emojisGrid}>
								{emojis.map(e => (
									<View
										key={`emoji-${e.id ?? e.name}`}
										style={[
											styles.emojiItem,
											{ backgroundColor: tokens.backgroundModifierAccent },
										]}
									>
										<Image
											source={{
												uri: `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? 'gif' : 'png'}?size=48`,
											}}
											style={styles.emojiImage}
										/>
									</View>
								))}
							</View>
						</View>
					) : null}

					{displayFeatures.length > 0 ? (
						<View style={styles.section}>
							<Text
								variant="text-xs/semibold"
								color="text-muted"
								style={[styles.sectionTitle, { color: tokens.textMuted }]}
							>
								FEATURES
							</Text>
							<View style={styles.featuresRow}>
								{displayFeatures.map(f => (
									<View
										key={`feat-${f}`}
										style={[
											styles.featureBadge,
											{ backgroundColor: tokens.backgroundModifierAccent },
										]}
									>
										<Text
											variant="text-xs/medium"
											color="text-muted"
											style={{ color: tokens.textMuted }}
										>
											{getFeatureLabel(f)}
										</Text>
									</View>
								))}
							</View>
						</View>
					) : null}

					<View style={styles.actionButtons}>
						{isJoined ? (
							<Button
								variant="secondary"
								text="Go to Server"
								onPress={() => {
									onClose()
									onView(guild)
								}}
							/>
						) : (
							<Button
								variant="primary"
								text={isJoining ? 'Joining Server...' : 'Join Server'}
								disabled={isJoining}
								onPress={() => onJoin(guild)}
							/>
						)}
						<Button variant="secondary" text="Close" onPress={onClose} />
					</View>
				</View>
			</ScrollView>
		</ActionSheet>
	)
}

const { height: screenHeight } = Dimensions.get('window')
const maxPreviewHeight = Math.min(
	680,
	Math.max(380, Math.round((screenHeight || 700) * 0.85)),
)

const styles = StyleSheet.create({
	sheetContent: {
		maxHeight: maxPreviewHeight,
	},
	scrollContainer: {
		paddingBottom: 24,
	},
	bannerContainer: {
		height: 120,
		width: '100%',
		position: 'relative',
	},
	bannerImage: {
		width: '100%',
		height: '100%',
	},
	bannerFallback: {
		width: '100%',
		height: '100%',
	},
	bannerOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0, 0, 0, 0.2)',
	},
	content: {
		paddingHorizontal: 16,
		paddingTop: 0,
	},
	avatarRow: {
		flexDirection: 'row',
		marginTop: -28,
		marginBottom: 10,
	},
	iconContainer: {
		width: 56,
		height: 56,
		borderRadius: 12,
		borderWidth: 2,
		overflow: 'hidden',
	},
	iconImage: {
		width: '100%',
		height: '100%',
	},
	iconFallback: {
		width: '100%',
		height: '100%',
		alignItems: 'center',
		justifyContent: 'center',
	},
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		marginBottom: 12,
	},
	titleText: {
		flexShrink: 1,
	},
	badgeWrapper: {
		marginLeft: 2,
	},
	statsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 16,
		marginBottom: 16,
	},
	statBox: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	statDivider: {
		width: 1,
		height: 20,
		marginHorizontal: 12,
	},
	onlineDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	memberDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	section: {
		marginBottom: 16,
	},
	sectionTitle: {
		letterSpacing: 0.5,
		marginBottom: 6,
	},
	descriptionText: {
		lineHeight: 20,
	},
	emojisGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	emojiItem: {
		width: 36,
		height: 36,
		borderRadius: 6,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emojiImage: {
		width: 28,
		height: 28,
	},
	featuresRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
	},
	featureBadge: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 6,
	},
	actionButtons: {
		marginTop: 8,
		gap: 8,
	},
})
