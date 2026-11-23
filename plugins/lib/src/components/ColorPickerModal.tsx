import { useState } from 'react'
import { ColorPicker } from './HtmlColorPicker'
import { PipModal } from './PipModal'

export interface ColorPickerModalProps {
	visible: boolean
	onClose: () => void
	title?: string
	subtitle?: string
	initialColor?: string
	onSelect: (color: string) => void
	onReset?: () => void
	maxWidth?: unknown
	maxHeight?: unknown
	allowGradient?: boolean
}

export function ColorPickerModal({
	visible,
	onClose,
	title = 'Color Palette',
	subtitle,
	initialColor = '#5865F2',
	onSelect,
	onReset,
	allowGradient = true,
}: ColorPickerModalProps) {
	const [isInteracting, setIsInteracting] = useState(false)

	return (
		<PipModal
			visible={visible}
			onClose={onClose}
			title={title}
			subtitle={subtitle}
			scrollable={true}
			scrollEnabled={!isInteracting}
		>
			<ColorPicker
				initialColor={initialColor}
				onSelect={onSelect}
				onReset={onReset}
				allowGradient={allowGradient}
				onInteractionChange={setIsInteracting}
			/>
		</PipModal>
	)
}
