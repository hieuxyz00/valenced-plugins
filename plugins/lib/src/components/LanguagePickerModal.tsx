import { SearchInput, TableRowAssetIcon } from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { useMemo, useState } from 'react'
import { PipModal } from './PipModal'

const { TableRow, TableRowGroup } = Design

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

/**
 * Native language picker action sheet.
 * Uses Discord TableRow, TableRowGroup and SearchInput.
 */
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

	const handleSelect = (code: string) => {
		onSelect(code)
		onClose()
	}

	return (
		<PipModal
			visible={visible}
			onClose={onClose}
			title={title}
			fixedHeader={
				<SearchInput
					placeholder="Search language name or code..."
					onChange={(v: string) => setQuery(v)}
				/>
			}
		>
			{!safeQuery && (
				<TableRowGroup title="Popular Languages">
					{allowAuto && (
						<TableRow
							label="Auto-detect"
							subLabel="auto"
							onPress={() => handleSelect('auto')}
							trailing={
								current === 'auto' ? (
									<TableRowAssetIcon name="CheckmarkLargeIcon" />
								) : undefined
							}
						/>
					)}
					{COMMON_LANGS.map(([code, name]) => (
						<TableRow
							key={code}
							label={name}
							subLabel={code}
							onPress={() => handleSelect(code)}
							trailing={
								current === code ? (
									<TableRowAssetIcon name="CheckmarkLargeIcon" />
								) : undefined
							}
						/>
					))}
				</TableRowGroup>
			)}

			<TableRowGroup title={safeQuery ? 'Search Results' : 'All Languages'}>
				{filtered.map(([code, name]) => (
					<TableRow
						key={code}
						label={name}
						subLabel={code}
						onPress={() => handleSelect(code)}
						trailing={
							current === code ? (
								<TableRowAssetIcon name="CheckmarkLargeIcon" />
							) : undefined
						}
					/>
				))}
			</TableRowGroup>
		</PipModal>
	)
}
