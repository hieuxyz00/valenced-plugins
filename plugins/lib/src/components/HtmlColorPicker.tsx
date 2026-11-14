import { Design } from '@valenced/discord/design'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import {
	getContrastColor,
	hexToRgb,
	hsvToRgb,
	rgbToHex,
	rgbToHsl,
	rgbToHsv,
} from '../math/color'
import type { GestureResponderEvent } from 'react-native'

const { Button, Card, Text, TextInput } = Design

export interface HtmlColorPickerProps {
	initialColor?: string
	onSelect: (color: string) => void
	onReset?: () => void
	allowGradient?: boolean
	onInteractionChange?: (isInteracting: boolean) => void
}

const CANVAS_WIDTH = 280
const CANVAS_HEIGHT = 120
const SLIDER_WIDTH = 280

const QUICK_HUES = [
	{ label: 'Red', h: 0, hex: '#ED4245' },
	{ label: 'Orange', h: 30, hex: '#FF7F50' },
	{ label: 'Yellow', h: 55, hex: '#FEE75C' },
	{ label: 'Green', h: 120, hex: '#57F287' },
	{ label: 'Cyan', h: 180, hex: '#00F2FE' },
	{ label: 'Blue', h: 220, hex: '#5865F2' },
	{ label: 'Purple', h: 280, hex: '#9B59B6' },
	{ label: 'Pink', h: 330, hex: '#EB459E' },
]

function parseInitialGradient(gradientStr?: string): {
	angle: number
	start: string
	end: string
} {
	const safeStr = typeof gradientStr === 'string' ? gradientStr : ''
	const angleMatch = safeStr.match(/(\d+)deg/)
	const angle = angleMatch ? Number.parseInt(angleMatch[1], 10) : 135
	const colors = safeStr.match(
		/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g,
	)
	const start = colors?.[0] ?? '#EB459E'
	const end = colors?.[1] ?? '#5865F2'
	return { angle, start, end }
}

export const HtmlColorPicker = memo(function HtmlColorPicker({
	initialColor = '#5865F2',
	onSelect,
	onReset,
	allowGradient = true,
	onInteractionChange,
}: HtmlColorPickerProps) {
	const safeInitialColor =
		typeof initialColor === 'string' && initialColor ? initialColor : '#5865F2'
	const isInitialGradient =
		allowGradient && safeInitialColor.includes('gradient')
	const parsedGradient = useMemo(
		() => (isInitialGradient ? parseInitialGradient(safeInitialColor) : null),
		[safeInitialColor, isInitialGradient],
	)

	const [isGradientMode, setIsGradientMode] = useState(isInitialGradient)
	const [activeGradientStop, setActiveGradientStop] = useState<'start' | 'end'>(
		'start',
	)
	const [gradientStart, setGradientStart] = useState(
		parsedGradient?.start ?? '#EB459E',
	)
	const [gradientEnd, setGradientEnd] = useState(
		parsedGradient?.end ?? '#5865F2',
	)
	const [gradientAngle, setGradientAngle] = useState(
		parsedGradient?.angle ?? 135,
	)

	const effectiveInitialHex = isInitialGradient
		? (parsedGradient?.start ?? '#EB459E')
		: safeInitialColor
	const initialRgb = hexToRgb(effectiveInitialHex) ?? { r: 88, g: 101, b: 242 }
	const initialHsv = rgbToHsv(initialRgb.r, initialRgb.g, initialRgb.b)

	const [hue, setHue] = useState<number>(initialHsv.h)
	const [saturation, setSaturation] = useState<number>(initialHsv.s)
	const [value, setValue] = useState<number>(initialHsv.v)

	const hueRef = useRef(hue)
	const saturationRef = useRef(saturation)
	const valueRef = useRef(value)
	hueRef.current = hue
	saturationRef.current = saturation
	valueRef.current = value

	const canvasRef = useRef<View>(null)
	const hueSliderRef = useRef<View>(null)
	const canvasRectRef = useRef<{ x: number; y: number } | null>(null)
	const hueRectRef = useRef<{ x: number } | null>(null)

	const onCanvasLayout = useCallback(() => {
		canvasRef.current?.measureInWindow?.((x, y) => {
			if (
				typeof x === 'number' &&
				typeof y === 'number' &&
				!Number.isNaN(x) &&
				!Number.isNaN(y)
			) {
				canvasRectRef.current = { x, y }
			}
		})
	}, [])

	const onHueLayout = useCallback(() => {
		hueSliderRef.current?.measureInWindow?.((x, _y) => {
			if (typeof x === 'number' && !Number.isNaN(x)) {
				hueRectRef.current = { x }
			}
		})
	}, [])

	const currentRgb = useMemo(
		() => hsvToRgb(hue, saturation, value),
		[hue, saturation, value],
	)
	const currentHex = useMemo(
		() => rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b),
		[currentRgb],
	)
	const currentHsl = useMemo(
		() => rgbToHsl(currentRgb.r, currentRgb.g, currentRgb.b),
		[currentRgb],
	)
	const contrastText = useMemo(() => getContrastColor(currentHex), [currentHex])

	const updateColorFromHsv = useCallback(
		(h: number, s: number, v: number) => {
			setHue(prevH => (prevH === h ? prevH : h))
			setSaturation(prevS => (Math.abs(prevS - s) < 0.001 ? prevS : s))
			setValue(prevV => (Math.abs(prevV - v) < 0.001 ? prevV : v))
			const rgb = hsvToRgb(h, s, v)
			const hex = rgbToHex(rgb.r, rgb.g, rgb.b)
			if (isGradientMode) {
				if (activeGradientStop === 'start') {
					setGradientStart(prev => (prev === hex ? prev : hex))
				} else {
					setGradientEnd(prev => (prev === hex ? prev : hex))
				}
			}
		},
		[activeGradientStop, isGradientMode],
	)

	const handleCanvasGrant = useCallback(
		(evt: GestureResponderEvent) => {
			onInteractionChange?.(true)
			canvasRef.current?.measureInWindow?.((x, y) => {
				if (
					typeof x === 'number' &&
					typeof y === 'number' &&
					!Number.isNaN(x) &&
					!Number.isNaN(y)
				) {
					canvasRectRef.current = { x, y }
				}
			})
			const { pageX, pageY, locationX, locationY } = evt.nativeEvent
			let relX: number
			let relY: number

			if (
				canvasRectRef.current &&
				typeof pageX === 'number' &&
				typeof pageY === 'number'
			) {
				relX = pageX - canvasRectRef.current.x
				relY = pageY - canvasRectRef.current.y
			} else {
				relX = typeof locationX === 'number' ? locationX : 0
				relY = typeof locationY === 'number' ? locationY : 0
			}

			const clampedX = Math.max(0, Math.min(CANVAS_WIDTH, relX))
			const clampedY = Math.max(0, Math.min(CANVAS_HEIGHT, relY))
			const s = clampedX / CANVAS_WIDTH
			const v = 1 - clampedY / CANVAS_HEIGHT
			updateColorFromHsv(hueRef.current, s, v)
		},
		[onInteractionChange, updateColorFromHsv],
	)

	const handleCanvasMove = useCallback(
		(evt: GestureResponderEvent) => {
			const { pageX, pageY, locationX, locationY } = evt.nativeEvent
			let relX: number
			let relY: number

			if (
				canvasRectRef.current &&
				typeof pageX === 'number' &&
				typeof pageY === 'number'
			) {
				relX = pageX - canvasRectRef.current.x
				relY = pageY - canvasRectRef.current.y
			} else {
				relX = typeof locationX === 'number' ? locationX : 0
				relY = typeof locationY === 'number' ? locationY : 0
			}

			const clampedX = Math.max(0, Math.min(CANVAS_WIDTH, relX))
			const clampedY = Math.max(0, Math.min(CANVAS_HEIGHT, relY))
			const s = clampedX / CANVAS_WIDTH
			const v = 1 - clampedY / CANVAS_HEIGHT
			updateColorFromHsv(hueRef.current, s, v)
		},
		[updateColorFromHsv],
	)

	const handleCanvasEnd = useCallback(() => {
		onInteractionChange?.(false)
	}, [onInteractionChange])

	const handleHueGrant = useCallback(
		(evt: GestureResponderEvent) => {
			onInteractionChange?.(true)
			hueSliderRef.current?.measureInWindow?.((x, _y) => {
				if (typeof x === 'number' && !Number.isNaN(x)) {
					hueRectRef.current = { x }
				}
			})
			const { pageX, locationX } = evt.nativeEvent
			let relX: number

			if (hueRectRef.current && typeof pageX === 'number') {
				relX = pageX - hueRectRef.current.x
			} else {
				relX = typeof locationX === 'number' ? locationX : 0
			}

			const clampedX = Math.max(0, Math.min(SLIDER_WIDTH, relX))
			const h = Math.round((clampedX / SLIDER_WIDTH) * 360)
			updateColorFromHsv(h, saturationRef.current, valueRef.current)
		},
		[onInteractionChange, updateColorFromHsv],
	)

	const handleHueMove = useCallback(
		(evt: GestureResponderEvent) => {
			const { pageX, locationX } = evt.nativeEvent
			let relX: number

			if (hueRectRef.current && typeof pageX === 'number') {
				relX = pageX - hueRectRef.current.x
			} else {
				relX = typeof locationX === 'number' ? locationX : 0
			}

			const clampedX = Math.max(0, Math.min(SLIDER_WIDTH, relX))
			const h = Math.round((clampedX / SLIDER_WIDTH) * 360)
			updateColorFromHsv(h, saturationRef.current, valueRef.current)
		},
		[updateColorFromHsv],
	)

	const handleHueEnd = useCallback(() => {
		onInteractionChange?.(false)
	}, [onInteractionChange])

	const selectGradientStop = useCallback(
		(stop: 'start' | 'end') => {
			setActiveGradientStop(stop)
			const targetHex = stop === 'start' ? gradientStart : gradientEnd
			const rgb = hexToRgb(targetHex)
			if (rgb) {
				const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
				setHue(hsv.h)
				setSaturation(hsv.s)
				setValue(hsv.v)
			}
		},
		[gradientStart, gradientEnd],
	)

	const toggleGradient = useCallback(() => {
		setIsGradientMode(prev => {
			const next = !prev
			if (next) {
				const rgb = hexToRgb(gradientStart)
				if (rgb) {
					const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
					setHue(hsv.h)
					setSaturation(hsv.s)
					setValue(hsv.v)
				}
				setActiveGradientStop('start')
			}
			return next
		})
	}, [gradientStart])

	const handleHexInput = (text: string) => {
		const rgb = hexToRgb(text)
		if (rgb) {
			const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
			updateColorFromHsv(hsv.h, hsv.s, hsv.v)
		}
	}

	// Thumb coordinates
	const thumbX = Math.max(
		0,
		Math.min(CANVAS_WIDTH - 16, saturation * CANVAS_WIDTH - 8),
	)
	const thumbY = Math.max(
		0,
		Math.min(CANVAS_HEIGHT - 16, (1 - value) * CANVAS_HEIGHT - 8),
	)
	const hueThumbX = Math.max(
		0,
		Math.min(SLIDER_WIDTH - 14, (hue / 360) * SLIDER_WIDTH - 7),
	)

	const builtGradient = `linear-gradient(${gradientAngle}deg, ${gradientStart} 0%, ${gradientEnd} 100%)`

	return (
		<View style={{ width: '100%', alignItems: 'center' }}>
			{/* Optional Gradient Toggle Header */}
			{allowGradient ? (
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'space-between',
						width: '100%',
						maxWidth: CANVAS_WIDTH,
						marginBottom: 8,
						paddingHorizontal: 2,
					}}
				>
					<Text variant="text-xs/bold" color="header-secondary">
						{isGradientMode ? 'CSS GRADIENT' : 'SOLID COLOR'}
					</Text>
					<Pressable
						hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
						onPress={toggleGradient}
						style={({ pressed }) => ({
							flexDirection: 'row',
							alignItems: 'center',
							gap: 6,
							paddingHorizontal: 10,
							paddingVertical: 4,
							borderRadius: 12,
							backgroundColor: isGradientMode
								? '#5865F2'
								: pressed
									? 'rgba(255, 255, 255, 0.16)'
									: 'rgba(255, 255, 255, 0.08)',
							borderWidth: 1,
							borderColor: isGradientMode
								? '#5865F2'
								: 'rgba(255, 255, 255, 0.14)',
							opacity: pressed ? 0.8 : 1,
							transform: [{ scale: pressed ? 0.95 : 1 }],
						})}
					>
						<View
							style={{
								width: 6,
								height: 6,
								borderRadius: 3,
								backgroundColor: isGradientMode
									? '#57F287'
									: 'rgba(255, 255, 255, 0.35)',
							}}
						/>
						<Text
							variant="text-xs/bold"
							style={{
								color: isGradientMode ? '#FFFFFF' : '#949BA4',
								fontSize: 11,
							}}
						>
							{isGradientMode ? 'Gradient: On' : 'Enable Gradient'}
						</Text>
					</Pressable>
				</View>
			) : null}

			{/* In Gradient Mode: Live Banner & Interactive Stop Selector */}
			{isGradientMode ? (
				<View style={{ width: SLIDER_WIDTH, marginBottom: 8 }}>
					{/* Live Gradient Preview Swatch (compact 32px height) */}
					<View
						style={[
							{
								height: 32,
								borderRadius: 6,
								borderWidth: 1,
								borderColor: 'rgba(255, 255, 255, 0.2)',
								marginBottom: 6,
								justifyContent: 'center',
								alignItems: 'center',
							},
							{ experimental_backgroundImage: builtGradient },
						]}
					>
						<Text
							style={{
								color: '#FFFFFF',
								fontWeight: '700',
								fontSize: 11,
								textShadowColor: 'rgba(0,0,0,0.7)',
								textShadowRadius: 3,
								textShadowOffset: { width: 0, height: 1 },
							}}
						>
							{gradientStart} ➜ {gradientEnd} ({gradientAngle}°)
						</Text>
					</View>

					{/* Stop Selector: compact stop button sizes */}
					<View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
						<Pressable
							hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
							onPress={() => selectGradientStop('start')}
							style={({ pressed }) => ({
								flex: 1,
								flexDirection: 'row',
								alignItems: 'center',
								padding: 6,
								borderRadius: 6,
								backgroundColor:
									activeGradientStop === 'start'
										? 'rgba(88, 101, 242, 0.28)'
										: pressed
											? 'rgba(255, 255, 255, 0.12)'
											: 'rgba(255, 255, 255, 0.06)',
								borderWidth: activeGradientStop === 'start' ? 2 : 1,
								borderColor:
									activeGradientStop === 'start'
										? '#5865F2'
										: 'rgba(255, 255, 255, 0.1)',
								opacity: pressed ? 0.8 : 1,
								transform: [{ scale: pressed ? 0.96 : 1 }],
							})}
						>
							<View
								style={{
									width: 18,
									height: 18,
									borderRadius: 4,
									backgroundColor: gradientStart,
									borderWidth: 1,
									borderColor: '#FFFFFF',
									marginRight: 6,
								}}
							/>
							<View style={{ flex: 1 }}>
								<Text
									variant="text-xs/bold"
									style={{
										color:
											activeGradientStop === 'start' ? '#FFFFFF' : '#949BA4',
										fontSize: 11,
									}}
								>
									Start Color
								</Text>
								<Text
									variant="text-xs/normal"
									style={{ color: '#DBDEE1', fontSize: 10 }}
								>
									{gradientStart}
								</Text>
							</View>
						</Pressable>

						<Pressable
							hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
							onPress={() => selectGradientStop('end')}
							style={({ pressed }) => ({
								flex: 1,
								flexDirection: 'row',
								alignItems: 'center',
								padding: 6,
								borderRadius: 6,
								backgroundColor:
									activeGradientStop === 'end'
										? 'rgba(88, 101, 242, 0.28)'
										: pressed
											? 'rgba(255, 255, 255, 0.12)'
											: 'rgba(255, 255, 255, 0.06)',
								borderWidth: activeGradientStop === 'end' ? 2 : 1,
								borderColor:
									activeGradientStop === 'end'
										? '#5865F2'
										: 'rgba(255, 255, 255, 0.1)',
								opacity: pressed ? 0.8 : 1,
								transform: [{ scale: pressed ? 0.96 : 1 }],
							})}
						>
							<View
								style={{
									width: 18,
									height: 18,
									borderRadius: 4,
									backgroundColor: gradientEnd,
									borderWidth: 1,
									borderColor: '#FFFFFF',
									marginRight: 6,
								}}
							/>
							<View style={{ flex: 1 }}>
								<Text
									variant="text-xs/bold"
									style={{
										color: activeGradientStop === 'end' ? '#FFFFFF' : '#949BA4',
										fontSize: 11,
									}}
								>
									End Color
								</Text>
								<Text
									variant="text-xs/normal"
									style={{ color: '#DBDEE1', fontSize: 10 }}
								>
									{gradientEnd}
								</Text>
							</View>
						</Pressable>
					</View>

					{/* Direction Angles */}
					<View style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
						{[45, 90, 135, 180].map(angle => (
							<Pressable
								key={angle}
								hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
								onPress={() => setGradientAngle(angle)}
								style={({ pressed }) => ({
									flex: 1,
									paddingVertical: 4,
									borderRadius: 6,
									backgroundColor:
										gradientAngle === angle
											? '#5865F2'
											: pressed
												? 'rgba(255, 255, 255, 0.15)'
												: 'rgba(255, 255, 255, 0.08)',
									alignItems: 'center',
									opacity: pressed ? 0.8 : 1,
									transform: [{ scale: pressed ? 0.94 : 1 }],
								})}
							>
								<Text
									variant="text-xs/normal"
									style={{
										color: gradientAngle === angle ? '#FFFFFF' : '#DBDEE1',
										fontSize: 11,
									}}
								>
									{angle}°
								</Text>
							</Pressable>
						))}
					</View>
				</View>
			) : null}

			{/* 2D Saturation / Value Gradient Canvas (Active for both solid & gradient stop) */}
			<View
				ref={canvasRef}
				onLayout={onCanvasLayout}
				onStartShouldSetResponder={() => true}
				onStartShouldSetResponderCapture={() => true}
				onMoveShouldSetResponder={() => true}
				onMoveShouldSetResponderCapture={() => true}
				onResponderTerminationRequest={() => false}
				onResponderGrant={handleCanvasGrant}
				onResponderMove={handleCanvasMove}
				onResponderRelease={handleCanvasEnd}
				onResponderTerminate={handleCanvasEnd}
				hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
				style={{
					width: CANVAS_WIDTH,
					height: CANVAS_HEIGHT,
					borderRadius: 10,
					overflow: 'hidden',
					backgroundColor: `hsl(${hue}, 100%, 50%)`,
					position: 'relative',
					borderWidth: 1,
					borderColor: 'rgba(255, 255, 255, 0.15)',
					marginBottom: 8,
				}}
			>
				{/* Horizontal White-to-transparent Saturation overlay */}
				<View
					pointerEvents="none"
					style={[
						{
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
						},
						{
							experimental_backgroundImage:
								'linear-gradient(90deg, #FFFFFF 0%, rgba(255,255,255,0) 100%)',
						},
					]}
				/>

				{/* Vertical Transparent-to-black Value overlay */}
				<View
					pointerEvents="none"
					style={[
						{
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
						},
						{
							experimental_backgroundImage:
								'linear-gradient(180deg, rgba(0,0,0,0) 0%, #000000 100%)',
						},
					]}
				/>

				{/* Picker Ring Indicator Thumb */}
				<View
					pointerEvents="none"
					style={{
						position: 'absolute',
						left: thumbX,
						top: thumbY,
						width: 16,
						height: 16,
						borderRadius: 8,
						borderWidth: 2,
						borderColor: '#FFFFFF',
						backgroundColor: currentHex,
						shadowColor: '#000000',
						shadowOpacity: 0.8,
						shadowRadius: 3,
						shadowOffset: { width: 0, height: 1 },
						elevation: 4,
					}}
				/>
			</View>

			{/* Hue Spectrum Rainbow Bar */}
			<View style={{ width: SLIDER_WIDTH, marginBottom: 8 }}>
				<View
					ref={hueSliderRef}
					onLayout={onHueLayout}
					onStartShouldSetResponder={() => true}
					onStartShouldSetResponderCapture={() => true}
					onMoveShouldSetResponder={() => true}
					onMoveShouldSetResponderCapture={() => true}
					onResponderTerminationRequest={() => false}
					onResponderGrant={handleHueGrant}
					onResponderMove={handleHueMove}
					onResponderRelease={handleHueEnd}
					onResponderTerminate={handleHueEnd}
					hitSlop={{ top: 16, bottom: 16, left: 10, right: 10 }}
					style={[
						{
							width: SLIDER_WIDTH,
							height: 16,
							borderRadius: 8,
							borderWidth: 1,
							borderColor: 'rgba(255, 255, 255, 0.15)',
							position: 'relative',
							justifyContent: 'center',
						},
						{
							experimental_backgroundImage:
								'linear-gradient(90deg, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)',
						},
					]}
				>
					{/* Hue Slider Thumb */}
					<View
						pointerEvents="none"
						style={{
							position: 'absolute',
							left: hueThumbX,
							width: 14,
							height: 14,
							borderRadius: 7,
							borderWidth: 2,
							borderColor: '#FFFFFF',
							backgroundColor: `hsl(${hue}, 100%, 50%)`,
							shadowColor: '#000',
							shadowOpacity: 0.6,
							shadowRadius: 3,
							elevation: 3,
						}}
					/>
				</View>
			</View>

			{/* Quick Hues Shortcuts */}
			<View
				style={{
					flexDirection: 'row',
					gap: 6,
					marginBottom: 8,
					width: SLIDER_WIDTH,
					justifyContent: 'space-between',
				}}
			>
				{QUICK_HUES.map(item => (
					<Pressable
						key={item.label}
						hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
						onPress={() => updateColorFromHsv(item.h, 1, 1)}
						style={({ pressed }) => ({
							width: 22,
							height: 22,
							borderRadius: 11,
							backgroundColor: item.hex,
							borderWidth: Math.abs(hue - item.h) < 15 ? 2 : 1,
							borderColor:
								Math.abs(hue - item.h) < 15 ? '#FFFFFF' : 'rgba(0,0,0,0.3)',
							transform: [{ scale: pressed ? 0.88 : 1 }],
						})}
					/>
				))}
			</View>

			{/* Swatch & Input Card with compact single-line specs */}
			<Card
				style={{
					width: SLIDER_WIDTH,
					padding: 8,
					marginBottom: 8,
					backgroundColor: '#2B2D31',
				}}
			>
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 10,
						marginBottom: 6,
					}}
				>
					<View
						style={{
							width: 36,
							height: 36,
							borderRadius: 6,
							backgroundColor: currentHex,
							borderWidth: 1,
							borderColor: 'rgba(255, 255, 255, 0.2)',
							justifyContent: 'center',
							alignItems: 'center',
						}}
					>
						<Text
							style={{
								color: contrastText,
								fontSize: 9,
								fontWeight: '700',
							}}
						>
							HEX
						</Text>
					</View>
					<View style={{ flex: 1 }}>
						<TextInput
							label={
								isGradientMode
									? `Tuning ${activeGradientStop === 'start' ? 'Start' : 'End'} Color`
									: 'HEX Color'
							}
							value={currentHex}
							onChange={handleHexInput}
						/>
					</View>
				</View>

				{/* Compact Single-line RGB, HSV, HSL Specs */}
				<View
					style={{
						flexDirection: 'row',
						justifyContent: 'space-between',
						alignItems: 'center',
						paddingTop: 5,
						borderTopWidth: 1,
						borderTopColor: 'rgba(255, 255, 255, 0.08)',
					}}
				>
					<Text
						variant="text-xs/normal"
						style={{ color: '#949BA4', fontSize: 10 }}
					>
						RGB{' '}
						<Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
							{currentRgb.r},{currentRgb.g},{currentRgb.b}
						</Text>
					</Text>
					<Text
						variant="text-xs/normal"
						style={{ color: '#949BA4', fontSize: 10 }}
					>
						HSV{' '}
						<Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
							{hue}°,{Math.round(saturation * 100)}%,{Math.round(value * 100)}%
						</Text>
					</Text>
					<Text
						variant="text-xs/normal"
						style={{ color: '#949BA4', fontSize: 10 }}
					>
						HSL{' '}
						<Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
							{currentHsl.h}°,{currentHsl.s}%,{currentHsl.l}%
						</Text>
					</Text>
				</View>
			</Card>

			{/* Action Buttons */}
			<View
				style={{
					flexDirection: 'row',
					gap: 8,
					width: SLIDER_WIDTH,
				}}
			>
				<View style={{ flex: 1 }}>
					<Button
						text={isGradientMode ? 'Apply Gradient' : 'Apply Color'}
						variant="primary"
						onPress={() =>
							onSelect(isGradientMode ? builtGradient : currentHex)
						}
					/>
				</View>
				{onReset ? (
					<Button text="Reset" variant="secondary" onPress={onReset} />
				) : null}
			</View>
		</View>
	)
})
