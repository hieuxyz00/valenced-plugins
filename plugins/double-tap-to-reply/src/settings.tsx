import { Page } from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useSharedThemeTokens } from '../../../shared/theme'
import { DEFAULT_SETTINGS } from './types'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { DoubleTapSettings, OwnMessageAction } from './types'

type SettingsProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: DoubleTapSettings }>
>

const { TableRadioGroup, TableRadioRow, TableRowGroup, TableSwitchRow, Text } =
	Design
const PageComponent = Page
const ScrollViewComponent = ScrollView

export default function SettingsComponent({ api }: SettingsProps) {
	const storage = api.jsonStorage
	const raw =
		typeof storage?.use === 'function' ? storage.use() : storage?.cache
	const themeTokens = useSharedThemeTokens()

	const [local, setLocal] = useState<DoubleTapSettings>(() => ({
		...DEFAULT_SETTINGS,
		...(raw ?? {}),
	}))

	const settings: DoubleTapSettings = {
		...DEFAULT_SETTINGS,
		...local,
		...(raw ?? {}),
	}

	const update = (patch: Partial<DoubleTapSettings>) => {
		const next = { ...settings, ...patch }
		setLocal(next)
		if (typeof storage?.set === 'function') {
			void storage.set(patch)
		}
	}

	return (
		<PageComponent>
			<ScrollViewComponent
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.container}
			>
				<Text
					variant="heading-sm/bold"
					style={[styles.sectionTitle, { color: themeTokens.textHeader }]}
				>
					General
				</Text>
				<TableRowGroup>
					<TableSwitchRow
						label="Enable Double Tap to Reply"
						subLabel="Double-tap any message in chat to initiate a reply"
						value={settings.enabled}
						onValueChange={v => update({ enabled: v })}
					/>
					<TableSwitchRow
						label="Tap Timing Fallback"
						subLabel="Detect rapid double taps manually if native double-tap does not fire"
						value={settings.tapFallback}
						onValueChange={v => update({ tapFallback: v })}
					/>
				</TableRowGroup>

				<TableRadioGroup<OwnMessageAction>
					title="Own Message Action"
					value={settings.ownMessageAction}
					onChange={(v: OwnMessageAction) => update({ ownMessageAction: v })}
				>
					<TableRadioRow
						label="Reply"
						subLabel="Always reply when double-tapping your own messages"
						value="reply"
					/>
					<TableRadioRow
						label="Edit"
						subLabel="Start editing when double-tapping your own messages"
						value="edit"
					/>
				</TableRadioGroup>
			</ScrollViewComponent>
		</PageComponent>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 16,
		paddingBottom: 40,
	},
	sectionTitle: {
		marginTop: 12,
		marginBottom: 8,
	},
})
