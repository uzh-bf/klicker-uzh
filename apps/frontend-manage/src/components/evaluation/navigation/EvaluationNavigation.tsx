import { faPieChart } from '@fortawesome/free-solid-svg-icons'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import type { StackEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type {
  ActiveStackType,
  ActivityEvaluationType,
} from '../ActivityEvaluation'
import useInstanceArrowNavigation from '../hooks/useInstanceArrowNavigation'
import useStackInstanceUpdates from '../hooks/useStackInstanceUpdates'
import InstanceNavigation from './InstanceNavigation'
import StackNavigation from './StackNavigation'

interface EvaluationNavigationProps {
  courseId: string
  activityId: string
  stacks: StackEvaluation[]
  stackInstanceMap: Record<number, { label: string; value: number }[]>
  activeStack: ActiveStackType
  setActiveStack: (stack: ActiveStackType) => void
  activeInstance: number
  setActiveInstance: (instance: number) => void
  numOfInstances: number
  type: ActivityEvaluationType
  leaderboardAvailable?: boolean
  feedbacksAvailable?: boolean
  escapeRoomAvailable?: boolean
}

function EvaluationNavigation({
  courseId,
  activityId,
  stacks,
  stackInstanceMap,
  activeStack,
  setActiveStack,
  activeInstance,
  setActiveInstance,
  numOfInstances,
  type,
  leaderboardAvailable,
  feedbacksAvailable,
  escapeRoomAvailable,
}: EvaluationNavigationProps) {
  const t = useTranslations()
  const learningAnalyticsEnabled = useFeatureFlag('learning-analytics')

  // automatically switch the active stack based on the active instance
  useStackInstanceUpdates({
    activeInstance,
    stackInstanceMap,
    setActiveStack,
  })

  // enable navigation using keyboard arrows
  useInstanceArrowNavigation({
    activeInstance,
    setActiveInstance,
    numOfInstances,
  })

  const analyticsButton = (
    <Button
      disabled={!learningAnalyticsEnabled}
      className={{ root: 'h-8 py-0' }}
      onClick={() =>
        window.open(`/analytics/${courseId}/quizzes/${activityId}`, '_blank')
      }
      data={{ cy: 'quiz-analytics' }}
    >
      <Button.Icon icon={faPieChart} />
      <Button.Label>{t('manage.analytics.quizAnalytics')}</Button.Label>
    </Button>
  )

  return (
    <div className="flex w-full flex-row justify-between border-b-2 border-solid bg-white px-3 print:hidden">
      {typeof activeStack === 'number' ? (
        <InstanceNavigation
          stack={stacks[activeStack]}
          activeInstance={activeInstance ?? 0}
          setActiveInstance={setActiveInstance}
          numOfInstances={numOfInstances}
          instanceSelection={stackInstanceMap[activeStack]}
        />
      ) : (
        <div />
      )}
      <div className="flex flex-row items-center gap-4">
        {type === 'Asynchronous' ? (
          learningAnalyticsEnabled ? (
            analyticsButton
          ) : (
            <Tooltip
              tooltip={t('manage.analytics.featureUnavailable')}
              delay={0}
              dataContent={{ cy: 'quiz-analytics-disabled-reason' }}
            >
              {analyticsButton}
            </Tooltip>
          )
        ) : null}
        <StackNavigation
          stacks={stacks}
          activeStack={activeStack}
          setActiveStack={setActiveStack}
          stackInstanceMap={stackInstanceMap}
          setActiveInstance={setActiveInstance}
          type={type}
          leaderboardAvailable={leaderboardAvailable}
          feedbacksAvailable={feedbacksAvailable}
          escapeRoomAvailable={escapeRoomAvailable}
        />
      </div>
    </div>
  )
}

export default EvaluationNavigation
