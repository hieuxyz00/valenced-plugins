import { Design } from '@valenced/discord/design'
import { useCallback, useEffect, useRef } from 'react'
import {
	Animated,
	Dimensions,
	Easing,
	Modal,
	PanResponder,
	Pressable,
	ScrollView,
	View,
} from 'react-native'
import type { ReactNode } from 'react'
import type {
	DimensionValue,
	NativeScrollEvent,
	NativeSyntheticEvent,
} from 'react-native'

const { Button, Text } = Design
const AnimatedView = Animated.View

export interface PipModalProps {
	visible: boolean
	onClose: () => void
	title?: string
	subtitle?: string
	children: ReactNode
	fixedHeader?: ReactNode
	actions?: ReactNode
	width?: DimensionValue
	height?: DimensionValue
	maxHeight?: DimensionValue
	maxWidth?: DimensionValue
	position?: 'side' | 'bottom' | 'center'
	onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
	scrollable?: boolean
	scrollEnabled?: boolean
}

export function PipModal({
	visible,
	onClose,
	title = '',
	subtitle,
	children,
	fixedHeader,
	actions,
	height = '78%',
	maxHeight = '90%',
	maxWidth = 500,
	scrollable = true,
	scrollEnabled = true,
	onScroll,
}: PipModalProps) {
	const windowHeight = Dimensions.get('window').height || 900
	const panY = useRef(new Animated.Value(windowHeight)).current
	const onCloseRef = useRef(onClose)
	const isClosingRef = useRef(false)

	useEffect(() => {
		onCloseRef.current = onClose
	}, [onClose])

	const handleClose = useCallback(() => {
		if (isClosingRef.current) return
		isClosingRef.current = true
		Animated.timing(panY, {
			toValue: windowHeight,
			duration: 220,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start(() => {
			onCloseRef.current()
			isClosingRef.current = false
		})
	}, [panY, windowHeight])

	const panResponder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onStartShouldSetPanResponderCapture: () => false,
			onMoveShouldSetPanResponder: (_, gestureState) =>
				gestureState.dy > 8 &&
				Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5,
			onMoveShouldSetPanResponderCapture: () => false,
			onPanResponderGrant: () => {
				panY.stopAnimation?.()
			},
			onPanResponderMove: (_, gestureState) => {
				const clampedY = Math.max(0, gestureState.dy)
				panY.setValue(clampedY)
			},
			onPanResponderRelease: (_, gestureState) => {
				const isDownwardSwipe =
					gestureState.dy > 140 ||
					(gestureState.dy > 60 && gestureState.vy > 0.7)

				if (isDownwardSwipe) {
					handleClose()
				} else {
					Animated.spring(panY, {
						toValue: 0,
						useNativeDriver: true,
						bounciness: 3,
						speed: 18,
					}).start()
				}
			},
			onPanResponderTerminate: () => {
				Animated.spring(panY, {
					toValue: 0,
					useNativeDriver: true,
					bounciness: 3,
					speed: 18,
				}).start()
			},
		}),
	).current

	useEffect(() => {
		if (visible) {
			isClosingRef.current = false
			panY.setValue(windowHeight)
			Animated.spring(panY, {
				toValue: 0,
				useNativeDriver: true,
				bounciness: 2,
				speed: 16,
			}).start()
		}
	}, [visible, panY, windowHeight])

	if (!visible) return null

	const maxComputedHeight =
		typeof maxHeight === 'number'
			? maxHeight
			: typeof maxHeight === 'string' && maxHeight.endsWith('%')
				? (windowHeight * Number.parseFloat(maxHeight)) / 100
				: windowHeight * 0.9

	return (
		<Modal
			visible={visible}
			transparent
			animationType="none"
			onRequestClose={handleClose}
		>
			<View
				style={{
					flex: 1,
					justifyContent: 'flex-end',
					alignItems: 'center',
				}}
			>
				<AnimatedView
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: '#000000',
						opacity: panY.interpolate({
							inputRange: [0, windowHeight],
							outputRange: [0.65, 0],
							extrapolate: 'clamp',
						}),
					}}
				>
					<Pressable onPress={handleClose} style={{ flex: 1 }} />
				</AnimatedView>

				<AnimatedView
					style={{
						width: '100%',
						maxWidth,
						height,
						maxHeight: maxComputedHeight,
						backgroundColor: '#1E1F22',
						borderTopLeftRadius: 16,
						borderTopRightRadius: 16,
						overflow: 'hidden',
						elevation: 16,
						shadowColor: '#000000',
						shadowOpacity: 0.6,
						shadowRadius: 16,
						shadowOffset: { width: 0, height: -4 },
						transform: [{ translateY: panY }],
					}}
				>
					<View
						{...panResponder.panHandlers}
						collapsable={false}
						style={{
							paddingTop: 10,
							paddingBottom: 8,
							alignItems: 'center',
							justifyContent: 'center',
							width: '100%',
						}}
					>
						<View
							style={{
								width: 36,
								height: 4,
								borderRadius: 2,
								backgroundColor: 'rgba(255, 255, 255, 0.35)',
							}}
						/>
					</View>

					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							justifyContent: 'space-between',
							paddingHorizontal: 16,
							paddingBottom: 10,
							borderBottomWidth: 1,
							borderBottomColor: 'rgba(255, 255, 255, 0.08)',
						}}
					>
						<View
							{...panResponder.panHandlers}
							collapsable={false}
							style={{ flex: 1, paddingRight: 8 }}
						>
							{title ? (
								<Text
									variant="heading-sm/bold"
									color="header-primary"
									numberOfLines={1}
								>
									{title}
								</Text>
							) : null}
							{subtitle ? (
								<Text
									variant="text-xs/normal"
									color="text-muted"
									style={{ marginTop: 2 }}
									numberOfLines={1}
								>
									{subtitle}
								</Text>
							) : null}
						</View>

						<Button
							text="Close"
							size="sm"
							variant="secondary"
							onPress={handleClose}
						/>
					</View>

					{fixedHeader ? (
						<View
							style={{
								paddingHorizontal: 16,
								paddingVertical: 10,
								borderBottomWidth: 1,
								borderBottomColor: 'rgba(255, 255, 255, 0.06)',
							}}
						>
							{fixedHeader}
						</View>
					) : null}

					{scrollable ? (
						<ScrollView
							style={{ flex: 1 }}
							contentContainerStyle={{
								paddingHorizontal: 16,
								paddingTop: 12,
								paddingBottom: 36,
							}}
							scrollEnabled={scrollEnabled}
							keyboardShouldPersistTaps="handled"
							nestedScrollEnabled={true}
							showsVerticalScrollIndicator={true}
							onScroll={onScroll}
							scrollEventThrottle={16}
						>
							{children}
						</ScrollView>
					) : (
						<View style={{ flex: 1, padding: 12 }}>{children}</View>
					)}

					{actions ? (
						<View
							style={{
								paddingHorizontal: 16,
								paddingVertical: 12,
								borderTopWidth: 1,
								borderTopColor: 'rgba(255, 255, 255, 0.08)',
								backgroundColor: '#2B2D31',
							}}
						>
							{actions}
						</View>
					) : null}
				</AnimatedView>
			</View>
		</Modal>
	)
}
