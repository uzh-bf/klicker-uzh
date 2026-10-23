export type { AdaptivePracticeQuizProgress } from '@klicker-uzh/adaptive-pwa-ui/source/components/practiceQuiz/adaptive/AdaptivePracticeQuiz.tsx'

import { AdaptivePracticeQuiz } from '@klicker-uzh/adaptive-pwa-ui'
import type { ComponentProps } from 'react'
import {
  AdaptivePwaHostProvider,
  adaptivePwaHostPorts,
} from '../../../adaptive/AdaptivePwaHostProvider'
export default function AdaptivePracticeQuizHostWrapper(
  props: ComponentProps<typeof AdaptivePracticeQuiz>
) {
  return (
    <AdaptivePwaHostProvider ports={adaptivePwaHostPorts}>
      <AdaptivePracticeQuiz {...props} />
    </AdaptivePwaHostProvider>
  )
}
