import { AdaptivePracticeQuizSetupStep } from '@klicker-uzh/adaptive-manage-ui'
import type { ComponentProps } from 'react'
import {
  AdaptiveManageHostProvider,
  adaptiveManageHostPorts,
} from '../../../../adaptive/AdaptiveManageHostProvider'
export default function AdaptiveHostWrapper(
  props: ComponentProps<typeof AdaptivePracticeQuizSetupStep>
) {
  return (
    <AdaptiveManageHostProvider ports={adaptiveManageHostPorts}>
      <AdaptivePracticeQuizSetupStep {...props} />
    </AdaptiveManageHostProvider>
  )
}
