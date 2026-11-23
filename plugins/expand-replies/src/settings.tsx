import Page from '@valenced/components/Page'
import TableRowAssetIcon from '@valenced/components/TableRowAssetIcon'
import { AlertActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { ScrollView, StyleSheet } from 'react-native'
import { isAndroid } from './native'
import { DefaultSettings } from './types'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings } from './types'

type SettingsProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: Settings }>
>

const {
	AlertActionButton,
	AlertModal,
	TableRow,
	TableRowGroup,
	TableSwitchRow,
	TextInput,
} = Design

function openLinesAlert(current: number, onSave: (val: number) => void) {
	const key = 'expand-replies-lines'
	let buffer = String(Math.max(current, 0))

	AlertActionCreators.openAlert(
		key,
		<AlertModal
			title="Maximum Lines"
			content="Enter the maximum number of lines to display before truncating (0 for unlimited):"
			extraContent={
				<TextInput
					size="md"
					defaultValue={buffer}
					placeholder="0"
					returnKeyType="done"
					onChange={(val: string) => {
						buffer = val
					}}
				/>
			}
			actions={
				<>
					<AlertActionButton
						text="Save"
						variant="primary"
						onPress={() => {
							const trimmed = buffer.trim()
							const parsed = Number.parseInt(trimmed, 10)
							if (!Number.isNaN(parsed) && parsed >= 0) {
								onSave(parsed)
							}
							AlertActionCreators.dismissAlert(key)
						}}
					/>
					<AlertActionButton
						text="Reset Default"
						variant="secondary"
						onPress={() => {
							onSave(DefaultSettings.maxLines)
							AlertActionCreators.dismissAlert(key)
						}}
					/>
					<AlertActionButton
						text="Cancel"
						variant="secondary"
						onPress={() => AlertActionCreators.dismissAlert(key)}
					/>
				</>
			}
		/>,
	)
}

function openCharsAlert(current: number, onSave: (val: number) => void) {
	const key = 'expand-replies-chars'
	let buffer = String(Math.max(current, 0))

	AlertActionCreators.openAlert(
		key,
		<AlertModal
			title="Maximum Characters"
			content="Enter maximum characters to display (0 for unlimited):"
			extraContent={
				<TextInput
					size="md"
					defaultValue={buffer}
					placeholder="0"
					returnKeyType="done"
					onChange={(val: string) => {
						buffer = val
					}}
				/>
			}
			actions={
				<>
					<AlertActionButton
						text="Save"
						variant="primary"
						onPress={() => {
							const trimmed = buffer.trim()
							const parsed = Number.parseInt(trimmed, 10)
							if (!Number.isNaN(parsed) && parsed >= 0) {
								onSave(parsed)
							}
							AlertActionCreators.dismissAlert(key)
						}}
					/>
					<AlertActionButton
						text="Reset Default"
						variant="secondary"
						onPress={() => {
							onSave(DefaultSettings.maxChars)
							AlertActionCreators.dismissAlert(key)
						}}
					/>
					<AlertActionButton
						text="Cancel"
						variant="secondary"
						onPress={() => AlertActionCreators.dismissAlert(key)}
					/>
				</>
			}
		/>,
	)
}

export default function SettingsComponent({ api }: SettingsProps) {
	const storage = api.jsonStorage
	const cached = storage.use()
	const settings = {
		...DefaultSettings,
		...(cached as Partial<Settings> | undefined),
	}

	return (
		<Page>
			<ScrollView
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={styles.scroll}
			>
				{!isAndroid && (
					<TableRowGroup title="Platform Compatibility">
						<TableRow
							label="iOS Notice"
							subLabel="Native reply un-clamping requires Android (Xposed). On iOS, reply expansion operates in JS preview mode and native chat line limits cannot be overridden."
							icon={<TableRowAssetIcon name="InfoIcon" />}
						/>
					</TableRowGroup>
				)}

				<TableRowGroup title="Size Limits">
					<TableRow
						label="Maximum Lines"
						subLabel={
							settings.maxLines > 0
								? `${settings.maxLines} lines`
								: 'Unlimited (0)'
						}
						onPress={() => {
							openLinesAlert(settings.maxLines, val => {
								void storage.set({ maxLines: val })
							})
						}}
					/>

					<TableRow
						label="Maximum Characters"
						subLabel={
							settings.maxChars > 0
								? `${settings.maxChars} characters`
								: 'Unlimited (0)'
						}
						onPress={() => {
							openCharsAlert(settings.maxChars, val => {
								void storage.set({ maxChars: val })
							})
						}}
					/>
				</TableRowGroup>

				<TableRowGroup title="Formatting">
					<TableSwitchRow
						label="Preserve Line Breaks"
						subLabel="Keep original line breaks instead of flattening into a single line"
						value={settings.preserveNewlines}
						onValueChange={val => {
							void storage.set({ preserveNewlines: val })
						}}
					/>

					<TableSwitchRow
						label="Align with Line 1"
						subLabel="Indent subsequent lines to match the first line text start instead of starting at left margin"
						value={settings.alignWithLine1}
						onValueChange={val => {
							void storage.set({ alignWithLine1: val })
						}}
					/>

					<TableSwitchRow
						label="Trim Message Content Indentation"
						subLabel="Remove leading whitespace and tabs from lines in the original message"
						value={settings.trimContentIndents}
						onValueChange={val => {
							void storage.set({ trimContentIndents: val })
						}}
					/>

					<TableSwitchRow
						label="Collapse Blank Lines"
						subLabel="Condense multiple consecutive empty lines to prevent excessive vertical gaps"
						value={settings.collapseEmptyLines}
						onValueChange={val => {
							void storage.set({ collapseEmptyLines: val })
						}}
					/>
				</TableRowGroup>
			</ScrollView>
		</Page>
	)
}

const styles = StyleSheet.create({
	scroll: {
		paddingBottom: 80,
	},
})
