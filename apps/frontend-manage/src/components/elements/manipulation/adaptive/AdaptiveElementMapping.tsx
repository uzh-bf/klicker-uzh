import { AdaptiveElementMapping } from '@klicker-uzh/adaptive-manage-ui'
import type { ComponentProps } from 'react'
import {
  AdaptiveManageHostProvider,
  adaptiveManageHostPorts,
} from '../../../../adaptive/AdaptiveManageHostProvider'
export default function AdaptiveHostWrapper(
  props: ComponentProps<typeof AdaptiveElementMapping>
) {
  return (
    <AdaptiveManageHostProvider ports={adaptiveManageHostPorts}>
      <AdaptiveElementMapping {...props} />
    </AdaptiveManageHostProvider>
  )
}
