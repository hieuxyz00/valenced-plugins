import { Design } from '@valenced/discord/design'
import { useEffect, useRef } from 'react'
import * as ReactNative from 'react-native'
import type { ReactNode } from 'react'
import type {
	DimensionValue,
	NativeScrollEvent,
	NativeSyntheticEvent,
	PanResponderCallbacks,
	ViewProps,
} from 'react-native'
import type { MockReactNativeModule } from './ColorPickerModal'

const { Modal, Pressable, ScrollView, View } = ReactNative
const { Text } = Design

class FallbackValue {
	_value = 0
	constructor(initial = 0) {
		this._value = initial
	}
	setValue(val: number) {
		this._value = val
	}
	stopAnimation() {}
}

const FallbackPanResponder = {
	create: (config: PanResponderCallbacks) => ({
		panHandlers: {},
		config,
	}),
}

const Animated =
	ReactNative.Animated ??
	(globalThis as { __MOCK_REACT_NATIVE__?: MockReactNativeModule })
		.__MOCK_REACT_NATIVE__?.Animated
const PanResponder =
	ReactNative.PanResponder ??
	(globalThis as { __MOCK_REACT_NATIVE__?: MockReactNativeModule })
		.__MOCK_REACT_NATIVE__?.PanResponder

const AnimatedView = (Animated?.View ?? View) as (
	props: ViewProps,
) => React.ReactNode
const ValueClass = Animated?.Value ?? FallbackValue
const PanResponderFactory = PanResponder ?? FallbackPanResponder

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
}

/**
 * PiP Modal for selections (Languages, Emojis, Icons).
 * Positioned docked to the side/bottom (not blocking the center of the screen).
 * Supports downward swipe-to-dismiss while strictly preventing free 2D window translation.
 */
export function PipModal({
	visible,
	onClose,
	title = '',
	subtitle,
	children,
	fixedHeader,
	actions,
	width = '100%',
	height = '74%',
	maxHeight = '88%',
	maxWidth = 440,
	position = 'side',
	onScroll,
	scrollable = true,
}: PipModalProps) {
	const panY = useRef(new ValueClass(0)).current

	const onCloseRef = useRef(onClose)
	useEffect(() => {
		onCloseRef.current = onClose
	}, [onClose])

	// When modal opens/closes (visible changes): reset panY to 0
	useEffect(() => {
		panY.setValue(0)
	}, [visible, panY])

	const panResponder = useRef(
		PanResponderFactory.create({
			onStartShouldSetPanResponder: () => true,
			onStartShouldSetPanResponderCapture: () => true,
			onMoveShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponderCapture: () => true,
			onPanResponderGrant: () => {
				panY.stopAnimation?.()
			},
			onPanResponderMove: (_, gestureState) => {
				// Constrain strictly to downward movement: clamped so it cannot move upward past 0.
				// No horizontal translation occurs.
				const clampedY = Math.max(0, gestureState.dy)
				panY.setValue(clampedY)
			},
			onPanResponderTerminationRequest: () => false,
			onPanResponderRelease: (_, gestureState) => {
				// Swipe-down-to-dismiss threshold:
				// Downward swipe (dy > 100 or positive downward velocity) while horizontal movement is small.
				const isDownwardSwipe =
					(gestureState.dy > 100 ||
						(gestureState.dy > 40 && gestureState.vy > 0.5)) &&
					Math.abs(gestureState.dx) < 80

				if (isDownwardSwipe) {
					onCloseRef.current()
				} else {
					// Sub-threshold drag: smoothly animate/spring panY back to 0
					if (typeof Animated?.spring === 'function') {
						Animated.spring(panY, {
							toValue: 0,
							useNativeDriver: false,
							bounciness: 4,
						}).start()
					} else if (typeof Animated?.timing === 'function') {
						Animated.timing(panY, {
							toValue: 0,
							duration: 200,
							useNativeDriver: false,
						}).start()
					} else {
						panY.setValue(0)
					}
				}
			},
			onPanResponderTerminate: () => {
				if (typeof Animated?.spring === 'function') {
					Animated.spring(panY, {
						toValue: 0,
						useNativeDriver: false,
						bounciness: 4,
					}).start()
				} else {
					panY.setValue(0)
				}
			},
		}),
	).current

	if (!visible) return null

	const justifyContent = position === 'center' ? 'center' : 'flex-end'
	const alignItems = position === 'side' ? 'flex-end' : 'center'

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<View
				style={{
					flex: 1,
					backgroundColor: 'rgba(0, 0, 0, 0.45)',
					justifyContent,
					alignItems,
					paddingHorizontal: 12,
					paddingVertical: 16,
				}}
			>
				{/* Backdrop click to dismiss */}
				<Pressable
					onPress={onClose}
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
					}}
				/>

				{/* Floating PiP Panel Window - animated vertically only, no horizontal translation */}
				<AnimatedView
					style={{
						width,
						maxWidth,
						height,
						maxHeight,
						backgroundColor: '#1E1F22',
						borderRadius: 16,
						borderWidth: 1,
						borderColor: 'rgba(255, 255, 255, 0.12)',
						overflow: 'hidden',
						elevation: 16,
						shadowColor: '#000000',
						shadowOpacity: 0.65,
						shadowRadius: 20,
						shadowOffset: { width: 0, height: 6 },
						flexDirection: 'column',
						transform: [{ translateY: panY }],
					}}
				>
					{/* Header Container */}
					<View
						style={{
							backgroundColor: '#2B2D31',
							borderBottomWidth: 1,
							borderBottomColor: 'rgba(255, 255, 255, 0.08)',
						}}
					>
						{/* Dedicated Top Drag Handle Bar with panHandlers - visual affordance for swipe-down */}
						<View
							{...panResponder.panHandlers}
							collapsable={false}
							style={{
								paddingTop: 8,
								paddingBottom: 6,
								paddingHorizontal: 16,
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
									backgroundColor: 'rgba(255, 255, 255, 0.4)',
								}}
							/>
						</View>

						{/* Title & Close Button Row - completely outside panHandlers */}
						<View
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'space-between',
								paddingHorizontal: 16,
								paddingBottom: 10,
							}}
						>
							<View style={{ flex: 1, paddingRight: 10, paddingVertical: 2 }}>
								{title ? (
									<Text
										variant="heading-sm/bold"
										style={{ color: '#FFFFFF' }}
										numberOfLines={1}
									>
										{title}
									</Text>
								) : null}
								{subtitle ? (
									<Text
										variant="text-xs/normal"
										style={{ color: '#949BA4', marginTop: 2 }}
										numberOfLines={1}
									>
										{subtitle}
									</Text>
								) : null}
							</View>

							{/* Close Button: flat and clean, completely outside panHandlers */}
							<Pressable
								hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
								onPress={onClose}
								style={({ pressed }) => ({
									width: 32,
									height: 32,
									justifyContent: 'center',
									alignItems: 'center',
									opacity: pressed ? 0.6 : 1,
								})}
							>
								<Text
									style={{
										color: '#DBDEE1',
										fontSize: 16,
										fontWeight: '700',
										lineHeight: 18,
									}}
								>
									✕
								</Text>
							</Pressable>
						</View>
					</View>

					{/* Fixed Header (Search input, filter chips, etc.) */}
					{fixedHeader ? (
						<View
							style={{
								paddingHorizontal: 16,
								paddingTop: 10,
								paddingBottom: 6,
								borderBottomWidth: 1,
								borderBottomColor: 'rgba(255, 255, 255, 0.05)',
							}}
						>
							{fixedHeader}
						</View>
					) : null}

					{/* Content Body */}
					{scrollable ? (
						<ScrollView
							style={{ flex: 1 }}
							contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
							keyboardShouldPersistTaps="always"
							nestedScrollEnabled
							onScroll={onScroll}
							scrollEventThrottle={32}
						>
							{children}
						</ScrollView>
					) : (
						<View style={{ flex: 1, padding: 12 }}>{children}</View>
					)}

					{/* Actions Footer */}
					{actions ? (
						<View
							style={{
								paddingHorizontal: 16,
								paddingVertical: 10,
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
