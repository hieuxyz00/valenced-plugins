import { Design } from '@valenced/discord/design'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useSharedThemeTokens } from '../../../../shared/theme'
import {
	getContrastColor,
	hexToRgb,
	hsvToRgb,
	rgbToHex,
	rgbToHsl,
	rgbToHsv,
} from '../math/color'
import type { GestureResponderEvent } from 'react-native'

const { Button, Card, Stack, Text, TextInput } = Design

export interface ColorPickerProps {
	initialColor?: string
	onSelect: (color: string) => void
	onReset?: () => void
	allowGradient?: boolean
	onInteractionChange?: (isInteracting: boolean) => void
}

export type HtmlColorPickerProps = ColorPickerProps

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

const GRADIENT_ANGLES = [45, 90, 135, 180]

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

export const ColorPicker = memo(function ColorPicker({
	initialColor = '#5865F2',
	onSelect,
	onReset,
	allowGradient = true,
	onInteractionChange,
}: ColorPickerProps) {
	const themeTokens = useSharedThemeTokens()
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
	const [customText, setCustomText] = useState(safeInitialColor)

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

	const builtGradient = useMemo(
		() =>
			`linear-gradient(${gradientAngle}deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
		[gradientAngle, gradientStart, gradientEnd],
	)

	const updateColorFromHsv = useCallback(
		(h: number, s: number, v: number) => {
			const safeH = Math.round(Math.max(0, Math.min(360, h)))
			const safeS = Math.max(0, Math.min(1, s))
			const safeV = Math.max(0, Math.min(1, v))

			setHue(safeH)
			setSaturation(safeS)
			setValue(safeV)

			const rgb = hsvToRgb(safeH, safeS, safeV)
			const hex = rgbToHex(rgb.r, rgb.g, rgb.b)

			if (isGradientMode) {
				if (activeGradientStop === 'start') {
					setGradientStart(hex)
					setCustomText(
						`linear-gradient(${gradientAngle}deg, ${hex} 0%, ${gradientEnd} 100%)`,
					)
				} else {
					setGradientEnd(hex)
					setCustomText(
						`linear-gradient(${gradientAngle}deg, ${gradientStart} 0%, ${hex} 100%)`,
					)
				}
			} else {
				setCustomText(hex)
			}
		},
		[
			activeGradientStop,
			gradientAngle,
			gradientEnd,
			gradientStart,
			isGradientMode,
		],
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

	const handleCustomTextChange = useCallback(
		(text: string) => {
			setCustomText(text)
			const trimmed = text.trim()
			if (trimmed.includes('gradient')) {
				setIsGradientMode(true)
				const parsed = parseInitialGradient(trimmed)
				setGradientStart(parsed.start)
				setGradientEnd(parsed.end)
				setGradientAngle(parsed.angle)
			} else if (trimmed.startsWith('#')) {
				const rgb = hexToRgb(trimmed)
				if (rgb) {
					const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
					updateColorFromHsv(hsv.h, hsv.s, hsv.v)
				}
			}
		},
		[updateColorFromHsv],
	)

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

	return (
		<Stack spacing={14}>
			{allowGradient && (
				<Card style={{ padding: 10 }}>
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							justifyContent: 'space-between',
							marginBottom: isGradientMode ? 8 : 0,
						}}
					>
						<Text
							variant="text-xs/bold"
							style={{ color: themeTokens.textMuted }}
						>
							{isGradientMode ? 'CSS GRADIENT' : 'SOLID COLOR'}
						</Text>
						<Button
							text={isGradientMode ? 'Gradient: On' : 'Enable Gradient'}
							size="sm"
							variant={isGradientMode ? 'primary' : 'secondary'}
							onPress={() => {
								const next = !isGradientMode
								setIsGradientMode(next)
								if (next) {
									setCustomText(
										`linear-gradient(${gradientAngle}deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
									)
								} else {
									setCustomText(currentHex)
								}
							}}
						/>
					</View>

					{isGradientMode && (
						<Stack spacing={8}>
							<View style={{ flexDirection: 'row', gap: 8 }}>
								<View style={{ flex: 1 }}>
									<Button
										text={`Start: ${gradientStart}`}
										size="sm"
										variant={
											activeGradientStop === 'start' ? 'primary' : 'secondary'
										}
										onPress={() => selectGradientStop('start')}
									/>
								</View>
								<View style={{ flex: 1 }}>
									<Button
										text={`End: ${gradientEnd}`}
										size="sm"
										variant={
											activeGradientStop === 'end' ? 'primary' : 'secondary'
										}
										onPress={() => selectGradientStop('end')}
									/>
								</View>
							</View>

							<View style={{ flexDirection: 'row', gap: 6 }}>
								{GRADIENT_ANGLES.map(deg => (
									<View key={deg} style={{ flex: 1 }}>
										<Button
											text={`${deg}°`}
											size="sm"
											variant={gradientAngle === deg ? 'primary' : 'secondary'}
											onPress={() => {
												setGradientAngle(deg)
												setCustomText(
													`linear-gradient(${deg}deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
												)
											}}
										/>
									</View>
								))}
							</View>
						</Stack>
					)}
				</Card>
			)}

			<Card style={{ padding: 12, alignItems: 'center' }}>
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
						borderColor: themeTokens.cardBorder,
						marginBottom: 10,
					}}
				>
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
							elevation: 4,
						}}
					/>
				</View>

				<View style={{ width: SLIDER_WIDTH, marginBottom: 12 }}>
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
						hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
						style={[
							{
								width: SLIDER_WIDTH,
								height: 16,
								borderRadius: 8,
								borderWidth: 1,
								borderColor: themeTokens.cardBorder,
								position: 'relative',
								justifyContent: 'center',
							},
							{
								experimental_backgroundImage:
									'linear-gradient(90deg, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)',
							},
						]}
					>
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
								elevation: 3,
							}}
						/>
					</View>
				</View>

				<View
					style={{
						flexDirection: 'row',
						justifyContent: 'space-between',
						width: SLIDER_WIDTH,
					}}
				>
					{QUICK_HUES.map(item => (
						<Pressable
							key={item.label}
							hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
							onPress={() => updateColorFromHsv(item.h, 1, 1)}
							style={({ pressed }) => ({
								width: 24,
								height: 24,
								borderRadius: 12,
								backgroundColor: item.hex,
								borderWidth: Math.abs(hue - item.h) < 15 ? 2 : 1,
								borderColor:
									Math.abs(hue - item.h) < 15
										? themeTokens.interactiveActive
										: themeTokens.cardBorder,
								transform: [{ scale: pressed ? 0.9 : 1 }],
							})}
						/>
					))}
				</View>
			</Card>

			<Card style={{ padding: 12 }}>
				<Stack spacing={8}>
					<View
						style={[
							{
								height: 42,
								borderRadius: 8,
								justifyContent: 'center',
								alignItems: 'center',
								borderWidth: 1,
								borderColor: themeTokens.cardBorder,
							},
							isGradientMode
								? { experimental_backgroundImage: builtGradient }
								: { backgroundColor: currentHex },
						]}
					>
						<Text
							style={{
								color: isGradientMode ? '#FFFFFF' : contrastText,
								fontWeight: '700',
								fontSize: 13,
								textShadowColor: isGradientMode
									? themeTokens.isDark
										? 'rgba(0, 0, 0, 0.75)'
										: 'rgba(0, 0, 0, 0.4)'
									: undefined,
								textShadowOffset: isGradientMode
									? { width: 0, height: 1 }
									: undefined,
								textShadowRadius: isGradientMode ? 3 : undefined,
							}}
						>
							{isGradientMode
								? `${gradientStart} → ${gradientEnd} (${gradientAngle}°)`
								: currentHex}
						</Text>
					</View>

					<TextInput
						label={
							isGradientMode
								? `Custom Gradient (${activeGradientStop === 'start' ? 'Start' : 'End'} stop)`
								: 'Custom Hex Color'
						}
						value={customText}
						onChange={handleCustomTextChange}
					/>

					<View
						style={{
							flexDirection: 'row',
							justifyContent: 'space-between',
							alignItems: 'center',
							paddingTop: 4,
						}}
					>
						<Text
							variant="text-xs/normal"
							style={{ color: themeTokens.textMuted }}
						>
							RGB:{' '}
							<Text
								style={{ color: themeTokens.textNormal, fontWeight: '600' }}
							>
								{currentRgb.r}, {currentRgb.g}, {currentRgb.b}
							</Text>
						</Text>
						<Text
							variant="text-xs/normal"
							style={{ color: themeTokens.textMuted }}
						>
							HSV:{' '}
							<Text
								style={{ color: themeTokens.textNormal, fontWeight: '600' }}
							>
								{hue}°, {Math.round(saturation * 100)}%,{' '}
								{Math.round(value * 100)}%
							</Text>
						</Text>
						<Text
							variant="text-xs/normal"
							style={{ color: themeTokens.textMuted }}
						>
							HSL:{' '}
							<Text
								style={{ color: themeTokens.textNormal, fontWeight: '600' }}
							>
								{currentHsl.h}°, {currentHsl.s}%, {currentHsl.l}%
							</Text>
						</Text>
					</View>
				</Stack>
			</Card>

			<View style={{ flexDirection: 'row', gap: 8, paddingBottom: 8 }}>
				<View style={{ flex: 1 }}>
					<Button
						text={isGradientMode ? 'Apply Gradient' : 'Apply Color'}
						variant="primary"
						onPress={() =>
							onSelect(isGradientMode ? builtGradient : currentHex)
						}
					/>
				</View>
				{onReset && (
					<Button text="Reset" variant="destructive" onPress={onReset} />
				)}
			</View>
		</Stack>
	)
})

export const HtmlColorPicker = ColorPicker
