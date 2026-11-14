import { Design } from '@valenced/discord/design'
import { useEffect, useRef } from 'react'
import * as ReactNative from 'react-native'
import { HtmlColorPicker } from './HtmlColorPicker'
import type {
	DimensionValue,
	PanResponderCallbacks,
	ViewProps,
} from 'react-native'

const { Modal, Pressable, ScrollView, View } = ReactNative
const { Text } = Design

export interface MockReactNativeModule {
	Animated?: {
		View: (props: ViewProps) => React.ReactNode
		ValueXY: new (initial: {
			x: number
			y: number
		}) => {
			x: { _value: number }
			y: { _value: number }
			setValue: (val: { x: number; y: number }) => void
			setOffset: (val: { x: number; y: number }) => void
			extractOffset: () => void
			flattenOffset: () => void
			stopAnimation: () => void
		}
		Value?: new (
			initial: number,
		) => {
			_value: number
			setValue: (val: number) => void
			stopAnimation?: () => void
		}
		spring?: (
			value: unknown,
			config: {
				toValue: number | unknown
				useNativeDriver?: boolean
				bounciness?: number
				speed?: number
				tension?: number
				friction?: number
			},
		) => { start: (callback?: (result: { finished: boolean }) => void) => void }
		timing?: (
			value: unknown,
			config: {
				toValue: number | unknown
				duration?: number
				useNativeDriver?: boolean
			},
		) => { start: (callback?: (result: { finished: boolean }) => void) => void }
	}
	PanResponder?: {
		create: (config: PanResponderCallbacks) => {
			panHandlers: Record<string, unknown>
			config?: unknown
		}
	}
}

declare global {
	var __MOCK_REACT_NATIVE__: MockReactNativeModule | undefined
}

class FallbackValueXY {
	x = { _value: 0 }
	y = { _value: 0 }
	setValue(_val: { x: number; y: number }) {}
	setOffset(_val: { x: number; y: number }) {}
	extractOffset() {}
	flattenOffset() {}
	stopAnimation() {}
}

const FallbackPanResponder = {
	create: (config: PanResponderCallbacks) => ({
		panHandlers: {},
		config,
	}),
}

const Animated =
	ReactNative.Animated ?? globalThis.__MOCK_REACT_NATIVE__?.Animated
const PanResponder =
	ReactNative.PanResponder ?? globalThis.__MOCK_REACT_NATIVE__?.PanResponder

const AnimatedView = (Animated?.View ?? View) as (
	props: ViewProps,
) => React.ReactNode
const ValueXYClass = Animated?.ValueXY ?? FallbackValueXY
const PanResponderFactory = PanResponder ?? FallbackPanResponder

export interface ColorPickerModalProps {
	visible: boolean
	onClose: () => void
	title?: string
	subtitle?: string
	initialColor?: string
	onSelect: (color: string) => void
	onReset?: () => void
	maxWidth?: DimensionValue
	maxHeight?: DimensionValue
	allowGradient?: boolean
}

/**
 * Specialized compact PiP Color Picker Modal docked to the side/bottom.
 * Supports smooth dragging/moving anywhere on the screen via dedicated header drag handle.
 */
export function ColorPickerModal({
	visible,
	onClose,
	title = 'Color Picker',
	subtitle,
	initialColor = '#5865F2',
	onSelect,
	onReset,
	maxWidth = 350,
	maxHeight = '84%',
	allowGradient = true,
}: ColorPickerModalProps) {
	const pan = useRef(new ValueXYClass({ x: 0, y: 0 })).current

	const onCloseRef = useRef(onClose)
	useEffect(() => {
		onCloseRef.current = onClose
	}, [onClose])

	useEffect(() => {
		if (visible) {
			pan.setValue({ x: 0, y: 0 })
			pan.setOffset({ x: 0, y: 0 })
		}
	}, [visible, pan])

	const panResponder = useRef(
		PanResponderFactory.create({
			onStartShouldSetPanResponder: () => true,
			onStartShouldSetPanResponderCapture: () => true,
			onMoveShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponderCapture: () => true,
			onPanResponderGrant: () => {
				pan.stopAnimation()
				pan.extractOffset()
			},
			onPanResponderMove: (_, gestureState) => {
				pan.setValue({ x: gestureState.dx, y: gestureState.dy })
			},
			onPanResponderTerminationRequest: () => false,
			onPanResponderRelease: (_, gestureState) => {
				pan.flattenOffset()
				const isSwipeDownDismiss =
					gestureState.dy > 100 && Math.abs(gestureState.dx) < 80
				if (isSwipeDownDismiss) {
					onCloseRef.current()
				}
			},
			onPanResponderTerminate: () => {
				pan.flattenOffset()
			},
		}),
	).current

	if (!visible) return null

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
					justifyContent: 'flex-end',
					alignItems: 'flex-end',
					paddingHorizontal: 12,
					paddingBottom: 16,
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

				{/* Floating Draggable Compact PiP Color Palette Window */}
				<AnimatedView
					style={{
						width: '100%',
						maxWidth,
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
						transform: [{ translateX: pan.x }, { translateY: pan.y }],
					}}
				>
					{/* Compact Header Container */}
					<View
						style={{
							backgroundColor: '#2B2D31',
							borderBottomWidth: 1,
							borderBottomColor: 'rgba(255, 255, 255, 0.08)',
						}}
					>
						{/* Dedicated Top Drag Handle Bar with panHandlers */}
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

						{/* Header Content Row - Completely outside panHandlers */}
						<View
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'space-between',
								paddingHorizontal: 12,
								paddingBottom: 8,
							}}
						>
							<View
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 8,
									flex: 1,
									paddingVertical: 1,
								}}
							>
								{/* Small live swatch */}
								<View
									style={{
										width: 16,
										height: 16,
										borderRadius: 4,
										backgroundColor: initialColor.startsWith('#')
											? initialColor
											: '#5865F2',
										borderWidth: 1,
										borderColor: '#FFFFFF',
									}}
								/>
								<View style={{ flex: 1 }}>
									<Text
										variant="heading-sm/bold"
										style={{ color: '#FFFFFF' }}
										numberOfLines={1}
									>
										{title}
									</Text>
									{subtitle ? (
										<Text
											variant="text-xs/normal"
											style={{ color: '#949BA4' }}
											numberOfLines={1}
										>
											{subtitle}
										</Text>
									) : null}
								</View>
							</View>

							{/* Close Button: flat and clean outside panHandlers */}
							<Pressable
								hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
								onPress={onClose}
								style={({ pressed }) => ({
									width: 28,
									height: 28,
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

					{/* Scrollable Palette Body */}
					<ScrollView
						style={{ flexGrow: 0 }}
						contentContainerStyle={{ padding: 10, paddingBottom: 14 }}
						keyboardShouldPersistTaps="always"
						nestedScrollEnabled
					>
						<HtmlColorPicker
							initialColor={initialColor}
							onSelect={color => {
								onSelect(color)
								onClose()
							}}
							onReset={
								onReset
									? () => {
											onReset()
											onClose()
										}
									: undefined
							}
							allowGradient={allowGradient}
						/>
					</ScrollView>
				</AnimatedView>
			</View>
		</Modal>
	)
}
