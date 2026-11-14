import { Design } from '@valenced/discord/design'
import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { PipModal } from './PipModal'

const { Text, TextInput } = Design

export interface LanguagePickerModalProps {
	visible: boolean
	title: string
	current: string
	allowAuto?: boolean
	languages?: Record<string, string>
	onSelect: (code: string) => void
	onClose: () => void
}

const COMMON_LANGS: ReadonlyArray<[code: string, label: string]> = [
	['vi', 'Vietnamese'],
	['en', 'English'],
	['ja', 'Japanese'],
	['ko', 'Korean'],
	['zh-CN', 'Chinese'],
	['fr', 'French'],
	['de', 'German'],
	['es', 'Spanish'],
	['ru', 'Russian'],
	['th', 'Thai'],
]

export function LanguagePickerModal({
	visible,
	title,
	current,
	allowAuto,
	languages = {},
	onSelect,
	onClose,
}: LanguagePickerModalProps) {
	const [query, setQuery] = useState('')
	const safeQuery = query.trim().toLowerCase()

	const filtered = useMemo(() => {
		const list: Array<[code: string, name: string]> = []
		if (
			allowAuto &&
			(!safeQuery ||
				'auto-detect'.includes(safeQuery) ||
				'auto'.includes(safeQuery))
		) {
			list.push(['auto', 'Auto-detect'])
		}
		for (const [code, name] of Object.entries(languages ?? {})) {
			if (
				!safeQuery ||
				name.toLowerCase().includes(safeQuery) ||
				code.toLowerCase().includes(safeQuery)
			) {
				list.push([code, name])
			}
		}
		return list
	}, [allowAuto, languages, safeQuery])

	return (
		<PipModal
			visible={visible}
			onClose={onClose}
			title={title}
			subtitle="Tap to select target language"
			height="74%"
			fixedHeader={
				<View style={{ marginBottom: 4 }}>
					<TextInput
						placeholder="Search language name or code..."
						value={query}
						onChange={setQuery}
					/>
				</View>
			}
		>
			{/* Quick common language chips */}
			<View
				style={{
					flexDirection: 'row',
					flexWrap: 'wrap',
					gap: 6,
					marginBottom: 12,
				}}
			>
				{allowAuto ? (
					<Pressable
						onPress={() => {
							onSelect('auto')
							onClose()
						}}
						style={{
							paddingHorizontal: 8,
							paddingVertical: 5,
							borderRadius: 6,
							backgroundColor:
								current === 'auto' ? '#5865F2' : 'rgba(255, 255, 255, 0.08)',
						}}
					>
						<Text variant="text-xs/medium">Auto</Text>
					</Pressable>
				) : null}
				{COMMON_LANGS.map(([code, label]) => {
					const isSel = current === code
					return (
						<Pressable
							key={code}
							onPress={() => {
								onSelect(code)
								onClose()
							}}
							style={{
								paddingHorizontal: 8,
								paddingVertical: 5,
								borderRadius: 6,
								backgroundColor: isSel
									? '#5865F2'
									: 'rgba(255, 255, 255, 0.08)',
							}}
						>
							<Text variant="text-xs/medium">{label}</Text>
						</Pressable>
					)
				})}
			</View>

			{/* Language List */}
			<View style={{ gap: 2 }}>
				{filtered.map(([code, name]) => {
					const isSel = current === code
					return (
						<Pressable
							key={code}
							onPress={() => {
								onSelect(code)
								onClose()
							}}
							style={{
								flexDirection: 'row',
								justifyContent: 'space-between',
								alignItems: 'center',
								paddingVertical: 10,
								paddingHorizontal: 8,
								borderRadius: 6,
								backgroundColor: isSel
									? 'rgba(88, 101, 242, 0.2)'
									: 'transparent',
							}}
						>
							<Text
								variant="text-sm/medium"
								style={{
									color: isSel ? '#5865F2' : '#FFFFFF',
									fontWeight: isSel ? '700' : '400',
								}}
							>
								{isSel ? `✓ ${name}` : name}
							</Text>
							<Text variant="text-xs/normal" color="text-muted">
								{code}
							</Text>
						</Pressable>
					)
				})}
			</View>
		</PipModal>
	)
}
