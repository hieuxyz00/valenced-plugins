import { getAssetIdByName } from '@valenced/assets'
import { getModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { after, before } from '@valenced/patcher'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { findInTree } from '@valenced/utils/tree'
import { createElement } from 'react'
import { Image, Text } from 'react-native'
import { isReactElement } from '../types'
import type { SearchTree } from '@valenced/utils/tree'
import type { FunctionComponent } from 'react'
import type { ReactElementWithProps, TagModule } from '../types'

interface TagRenderProps {
	text?: string
	textColor?: string
	backgroundColor?: string
	icon?: string
}

interface ReactElementWithStringChild extends ReactElementWithProps {
	props: {
		children?: string
		style?: unknown
		[key: string]: unknown
	}
}

function isLabelElement(node: SearchTree): node is ReactElementWithStringChild {
	return isReactElement(node) && typeof node.props?.children === 'string'
}

export function patchTag(): () => void {
	const unsubs: Array<() => void> = []

	let currentProps: TagRenderProps | undefined

	const unsubModules = getModules(withProps<TagModule>('getBotLabel'), mod => {
		const moduleRecord = mod as Record<string, unknown>
		if (
			!('default' in moduleRecord) ||
			typeof moduleRecord.default !== 'function'
		) {
			return
		}

		const targetObj = moduleRecord as Record<
			string,
			(...args: unknown[]) => unknown
		>

		const unpatchBefore = before(targetObj, 'default', args => {
			const props = args[0] as TagRenderProps | undefined
			currentProps = props
			return args
		})

		const unpatchAfter = after(targetObj, 'default', rawRet => {
			const props = currentProps
			currentProps = undefined

			if (!rawRet || !props || !isReactElement(rawRet)) {
				return rawRet
			}

			const label = findInTree(rawRet as SearchTree, isLabelElement)

			if (label?.props) {
				if (props.text) {
					label.props.children = props.text
				}
				if (props.textColor) {
					const existingStyle = label.props.style
					label.props.style = Array.isArray(existingStyle)
						? [...existingStyle, { color: props.textColor }]
						: existingStyle !== undefined
							? [existingStyle, { color: props.textColor }]
							: [{ color: props.textColor }]
				}
			}

			if (props.backgroundColor && rawRet.props) {
				const isGradient = props.backgroundColor.includes('gradient')
				const bgStyle = isGradient
					? {
							backgroundColor: 'transparent',
							experimental_backgroundImage: props.backgroundColor,
							overflow: 'hidden' as const,
							borderRadius: 4,
							flexDirection: 'row' as const,
							alignItems: 'center' as const,
						}
					: {
							backgroundColor: props.backgroundColor,
							flexDirection: 'row' as const,
							alignItems: 'center' as const,
						}

				const existingStyle = rawRet.props.style
				rawRet.props.style = Array.isArray(existingStyle)
					? [...existingStyle, bgStyle]
					: existingStyle !== undefined
						? [existingStyle, bgStyle]
						: [bgStyle]
			}

			if (props.icon && rawRet.props) {
				let IconComponent:
					| FunctionComponent<{
							size?: string
							color?: string
							style?: unknown
					  }>
					| undefined
				if (props.icon.endsWith('Icon') || props.icon.includes('Icon')) {
					try {
						IconComponent = lookupGeneratedIconComponent(
							props.icon,
						) as typeof IconComponent
					} catch {}
				}
				const assetId = getAssetIdByName(props.icon)
				const iconElement =
					IconComponent !== undefined
						? createElement(IconComponent, {
								key: 'staff-tag-icon',
								size: 'xs',
								color: props.textColor,
								style: {
									width: 12,
									height: 12,
									marginRight: 3,
								},
							})
						: assetId !== undefined
							? createElement(Image, {
									key: 'staff-tag-icon',
									source: assetId,
									style: {
										width: 12,
										height: 12,
										marginRight: 3,
										tintColor: props.textColor,
									},
								})
							: createElement(
									Text,
									{
										key: 'staff-tag-icon',
										style: {
											fontSize: 10,
											marginRight: 2,
											color: props.textColor,
										},
									},
									props.icon,
								)

				const existingChildren = rawRet.props.children
				if (Array.isArray(existingChildren)) {
					const withoutIcon = existingChildren.filter(
						child => !isReactElement(child) || child.key !== 'staff-tag-icon',
					)
					rawRet.props.children = [iconElement, ...withoutIcon]
				} else if (existingChildren !== undefined) {
					rawRet.props.children = [iconElement, existingChildren]
				} else {
					rawRet.props.children = [iconElement]
				}

				const layoutStyle = {
					flexDirection: 'row' as const,
					alignItems: 'center' as const,
				}
				const existingStyle = rawRet.props.style
				rawRet.props.style = Array.isArray(existingStyle)
					? [...existingStyle, layoutStyle]
					: existingStyle !== undefined
						? [existingStyle, layoutStyle]
						: [layoutStyle]
			}

			return rawRet
		})

		unsubs.push(unpatchBefore, unpatchAfter)
	})

	unsubs.push(unsubModules)

	return () => {
		for (const unpatch of unsubs) {
			unpatch()
		}
	}
}
