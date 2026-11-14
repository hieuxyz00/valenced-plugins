import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings } from './types'

const { TableRowGroup, TableSwitchRow } = Design

type SettingsProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: Settings }>
>

export default function SettingsComponent({ api }: SettingsProps) {
	const storage = api.jsonStorage
	const settings = storage.use()

	return (
		<Page>
			<TableRowGroup title="General">
				<TableSwitchRow
					label="Auto No-Reply Mention"
					subLabel="Automatically set mention toggle to OFF when replying. Long-press the mention button in the reply bar to toggle this setting."
					value={settings?.enabled ?? true}
					onValueChange={(val: boolean) => {
						void storage.set({ enabled: val })
					}}
				/>
			</TableRowGroup>
		</Page>
	)
}
