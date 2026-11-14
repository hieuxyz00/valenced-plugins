import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { DefaultBypassSettings } from './types'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { ComponentProps } from 'react'
import type { BypassSettings } from './types'

const { Stack, TableRowGroup, TableSwitchRow } = Design

type SettingsComponentProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: BypassSettings }>
>

export default function SettingsComponent({ api }: SettingsComponentProps) {
	const storage = api.jsonStorage
	const settings: BypassSettings = {
		...DefaultBypassSettings,
		...(storage.use() as Partial<BypassSettings> | undefined),
	}

	return (
		<Page>
			<Stack spacing={16}>
				<TableRowGroup title="Channel & Server Gate Bypass">
					<TableSwitchRow
						label="Bypass Channel Gate"
						subLabel="Allow entering and viewing NSFW channels without prompts"
						value={settings.bypassChannelGate}
						onValueChange={(val: boolean) => {
							void storage.set({ bypassChannelGate: val })
						}}
					/>
					<TableSwitchRow
						label="Bypass Server NSFW Gate"
						subLabel="Automatically agree to server NSFW gates and age warnings"
						value={settings.bypassGuildGate}
						onValueChange={(val: boolean) => {
							void storage.set({ bypassGuildGate: val })
						}}
					/>
				</TableRowGroup>

				<TableRowGroup title="Age Verification Bypass">
					<TableSwitchRow
						label="Bypass Age Verification"
						subLabel="Suppress age verification checks and modal prompts"
						value={settings.bypassAgeVerification}
						onValueChange={(val: boolean) => {
							void storage.set({ bypassAgeVerification: val })
						}}
					/>
					<TableSwitchRow
						label="Force Adult Account Status"
						subLabel="Mark current user as adult (nsfwAllowed=true, ageVerificationStatus=4)"
						value={settings.forceAdultStatus}
						onValueChange={(val: boolean) => {
							void storage.set({ forceAdultStatus: val })
						}}
					/>
				</TableRowGroup>
			</Stack>
		</Page>
	)
}
