import { CompetenceTreeEditor } from '@klicker-uzh/adaptive-manage-ui'
import type { ComponentProps } from 'react'
import {
  AdaptiveManageHostProvider,
  adaptiveManageHostPorts,
} from '../../../adaptive/AdaptiveManageHostProvider'
export default function AdaptiveHostWrapper(
  props: ComponentProps<typeof CompetenceTreeEditor>
) {
  return (
    <AdaptiveManageHostProvider ports={adaptiveManageHostPorts}>
      <CompetenceTreeEditor {...props} />
    </AdaptiveManageHostProvider>
  )
}
