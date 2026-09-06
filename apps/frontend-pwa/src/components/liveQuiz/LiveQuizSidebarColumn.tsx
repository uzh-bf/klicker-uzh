import { Tabs } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import LiveQuizLeaderboard from '../common/LiveQuizLeaderboard'
import FeedbackArea from './FeedbackArea'

type RightTab = 'feedbacks' | 'leaderboard'
type ActiveView = 'questions' | 'feedbacks' | 'leaderboard'

interface LiveQuizSidebarColumnProps {
  quizId: string
  courseId?: string | null
  className?: string
  activeView: ActiveView
  feedbackAvailable: boolean
  leaderboardAvailable: boolean
  isLiveQAEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isGamificationEnabled: boolean
  hasParticipant: boolean
  rightTab: RightTab
  onRightTabChange: (tab: RightTab) => void
  beforeFirstBlock?: boolean | null
  isPartOfGamifiedCourse?: boolean | null
  isAssessmentEnabled: boolean
  isStandalone?: boolean
}

function LiveQuizSidebarColumn({
  quizId,
  courseId,
  activeView,
  feedbackAvailable,
  leaderboardAvailable,
  isLiveQAEnabled,
  isConfusionFeedbackEnabled,
  isGamificationEnabled,
  hasParticipant,
  rightTab,
  onRightTabChange,
  beforeFirstBlock,
  isPartOfGamifiedCourse,
  isAssessmentEnabled,
  isStandalone,
  className,
}: LiveQuizSidebarColumnProps) {
  const t = useTranslations()

  if (!feedbackAvailable && !leaderboardAvailable) {
    return null
  }

  const showTabs =
    (isLiveQAEnabled || isConfusionFeedbackEnabled) &&
    hasParticipant &&
    isGamificationEnabled

  return (
    <div
      className={twMerge(
        'flex h-full min-w-0 flex-col bg-white',
        isStandalone ? 'mx-auto' : undefined,
        className
      )}
    >
      {showTabs ? (
        <Tabs
          defaultValue={rightTab}
          value={rightTab}
          tabs={
            [
              {
                id: 'tab-feedbacks',
                value: 'feedbacks',
                label: t('shared.generic.feedbacks'),
                data: { cy: 'tab-feedbacks' },
              },
              {
                id: 'tab-leaderboard-right',
                value: 'leaderboard',
                label: t('shared.generic.leaderboard'),
                data: { cy: 'tab-leaderboard-right' },
              },
            ] as any
          }
          onValueChange={(value) => onRightTabChange(value as RightTab)}
          className={{
            root: 'mb-1.5 hidden md:block',
            list: 'h-7.5 md:h-7.5 bg-gray-200',
            trigger: 'h-6',
          }}
        >
          {' '}
        </Tabs>
      ) : null}

      <FeedbackArea
        key={quizId}
        isConfusionFeedbackEnabled={isConfusionFeedbackEnabled}
        isLiveQAEnabled={isLiveQAEnabled}
        className={twMerge(
          activeView === 'feedbacks' && feedbackAvailable ? 'block' : 'hidden',
          rightTab === 'feedbacks' && feedbackAvailable
            ? 'md:block'
            : 'md:hidden'
        )}
      />
      <LiveQuizLeaderboard
        quizId={quizId}
        courseId={courseId ?? undefined}
        isBeforeFirstBlock={beforeFirstBlock ?? false}
        showLeaderboardGamifiedQuizHint
        isPartOfGamifiedCourse={isPartOfGamifiedCourse}
        isAssessmentEnabled={isAssessmentEnabled}
        className={twMerge(
          activeView === 'leaderboard' && leaderboardAvailable
            ? 'block'
            : 'hidden',
          rightTab === 'leaderboard' && leaderboardAvailable
            ? 'md:block'
            : 'md:hidden',
          'min-h-full w-full'
        )}
      />
    </div>
  )
}

export default LiveQuizSidebarColumn
