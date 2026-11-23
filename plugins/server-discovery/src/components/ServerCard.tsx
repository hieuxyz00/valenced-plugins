import { Design } from '@valenced/discord/design'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { memo, useState } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import {
	formatCount,
	getGuildBannerUrl,
	getGuildIconUrl,
} from '../utils/format'
import { useThemeTokens } from '../utils/theme'
import type { DiscoverableGuild } from '../types'

function getCircleCheckIcon() {
	return lookupGeneratedIconComponent('CircleCheckIcon')
}

function getShieldIcon() {
	return lookupGeneratedIconComponent('ShieldIcon')
}

interface ServerCardProps {
	guild: DiscoverableGuild
	isJoined: boolean
	isJoining?: boolean
	onJoin: (guild: DiscoverableGuild) => void
	onView: (guild: DiscoverableGuild) => void
	onPreview: (guild: DiscoverableGuild) => void
}

function ServerCardComponent({
	guild,
	isJoined,
	isJoining = false,
	onJoin,
	onView,
	onPreview,
}: ServerCardProps) {
	const { Button, Text } = Design
	const tokens = useThemeTokens()

	const [bannerError, setBannerError] = useState(false)
	const [iconError, setIconError] = useState(false)

	const CircleCheckIcon = getCircleCheckIcon()
	const ShieldIcon = getShieldIcon()

	const bannerUrl = getGuildBannerUrl(guild, 480)
	const iconUrl = getGuildIconUrl(guild.id, guild.icon, 96)
	const isVerified = guild.features?.includes('VERIFIED')
	const isPartnered = guild.features?.includes('PARTNERED')

	const initialLetter = (guild.name ?? '').trim().charAt(0).toUpperCase() || '?'

	return (
		<View
			style={[
				styles.card,
				{
					backgroundColor: tokens.cardPrimaryBg,
					borderColor: tokens.borderSubtle,
				},
			]}
		>
			<Pressable
				onPress={() => onPreview(guild)}
				style={({ pressed }) => [pressed && styles.cardPressed]}
			>
				<View style={styles.bannerContainer}>
					{bannerUrl && !bannerError ? (
						<Image
							source={{ uri: bannerUrl }}
							style={styles.bannerImage}
							resizeMode="cover"
							onError={() => setBannerError(true)}
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
					<View style={styles.headerRow}>
						<View
							style={[
								styles.iconContainer,
								{
									borderColor: tokens.backgroundTertiary,
									backgroundColor: tokens.backgroundSecondary,
								},
							]}
						>
							{iconUrl && !iconError ? (
								<Image
									source={{ uri: iconUrl }}
									style={styles.iconImage}
									resizeMode="cover"
									onError={() => setIconError(true)}
								/>
							) : (
								<View
									style={[
										styles.iconFallback,
										{ backgroundColor: tokens.textBrand },
									]}
								>
									<Text
										variant="heading-md/bold"
										color="text-strong"
										style={{ color: tokens.textStrong }}
									>
										{initialLetter}
									</Text>
								</View>
							)}
						</View>

						<View style={styles.statsRow}>
							<View style={styles.statItem}>
								<View
									style={[
										styles.onlineDot,
										{ backgroundColor: tokens.statusOnline },
									]}
								/>
								<Text
									variant="text-xs/medium"
									color="text-muted"
									style={{ color: tokens.textMuted }}
								>
									{formatCount(guild.approximate_presence_count)} Online
								</Text>
							</View>
							<View style={styles.statItem}>
								<View
									style={[
										styles.memberDot,
										{ backgroundColor: tokens.iconMuted },
									]}
								/>
								<Text
									variant="text-xs/medium"
									color="text-muted"
									style={{ color: tokens.textMuted }}
								>
									{formatCount(guild.approximate_member_count)} Members
								</Text>
							</View>
						</View>
					</View>

					<View style={styles.titleRow}>
						<Text
							variant="heading-sm/semibold"
							color="text-strong"
							numberOfLines={1}
							style={[styles.guildName, { color: tokens.textStrong }]}
						>
							{guild.name}
						</Text>
						{isVerified && CircleCheckIcon ? (
							<View style={styles.badgeWrapper}>
								<CircleCheckIcon color={tokens.statusPositive} size="sm" />
							</View>
						) : null}
						{isPartnered && ShieldIcon ? (
							<View style={styles.badgeWrapper}>
								<ShieldIcon color={tokens.textBrand} size="sm" />
							</View>
						) : null}
					</View>

					{guild.description ? (
						<Text
							variant="text-sm/normal"
							color="text-muted"
							numberOfLines={2}
							style={[styles.description, { color: tokens.textMuted }]}
						>
							{guild.description}
						</Text>
					) : null}
				</View>
			</Pressable>

			<View style={styles.actionsContainer}>
				<View style={styles.actionsRow}>
					{isJoined ? (
						<Button
							size="sm"
							variant="secondary"
							text="Joined"
							onPress={() => onView(guild)}
							style={styles.actionBtn}
						/>
					) : (
						<Button
							size="sm"
							variant="primary"
							text={isJoining ? 'Joining...' : 'Join Server'}
							disabled={isJoining}
							onPress={() => onJoin(guild)}
							style={styles.actionBtn}
						/>
					)}
					<Button
						size="sm"
						variant="tertiary"
						text="Preview"
						onPress={() => onPreview(guild)}
						style={styles.previewBtn}
					/>
				</View>
			</View>
		</View>
	)
}

export const ServerCard = memo(ServerCardComponent)

const styles = StyleSheet.create({
	card: {
		borderRadius: 8,
		overflow: 'hidden',
		borderWidth: 1,
		marginBottom: 10,
	},
	cardPressed: {
		opacity: 0.9,
	},
	bannerContainer: {
		width: '100%',
		aspectRatio: 16 / 9,
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
		overflow: 'hidden',
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
		paddingHorizontal: 12,
		paddingTop: 0,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		justifyContent: 'space-between',
		marginTop: -24,
		marginBottom: 8,
	},
	iconContainer: {
		width: 48,
		height: 48,
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
	statsRow: {
		flexDirection: 'row',
		gap: 12,
		paddingBottom: 4,
	},
	statItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
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
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		marginBottom: 4,
	},
	guildName: {
		flexShrink: 1,
	},
	badgeWrapper: {
		marginLeft: 2,
	},
	description: {
		marginBottom: 8,
		lineHeight: 18,
	},
	actionsContainer: {
		paddingHorizontal: 12,
		paddingBottom: 12,
	},
	actionsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	actionBtn: {
		flex: 1,
	},
	previewBtn: {
		minWidth: 80,
	},
})
