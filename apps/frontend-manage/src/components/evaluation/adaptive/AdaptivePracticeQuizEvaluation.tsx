import { AdaptivePracticeQuizEvaluation } from '@klicker-uzh/adaptive-manage-ui'
import type { ComponentProps } from 'react'
import {
  AdaptiveManageHostProvider,
  adaptiveManageHostPorts,
} from '../../../adaptive/AdaptiveManageHostProvider'
export default function AdaptiveHostWrapper(
  props: ComponentProps<typeof AdaptivePracticeQuizEvaluation>
) {
  return (
    <AdaptiveManageHostProvider ports={adaptiveManageHostPorts}>
      <AdaptivePracticeQuizEvaluation {...props} />
    </AdaptiveManageHostProvider>
  )
}
