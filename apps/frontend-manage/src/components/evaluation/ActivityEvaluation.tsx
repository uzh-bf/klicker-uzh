import { useQuery } from '@apollo/client'
import EscapeRoomProgress from '@components/evaluation/EscapeRoomProgress'
import {
  ConfusionTimestep,
  Feedback,
  GetEscapeRoomProgressDocument,
  LocaleType,
  StackEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import Leaderboard, {
  LeaderboardCombinedEntry,
} from '@klicker-uzh/shared-components/src/Leaderboard'
import useEvaluationInitialization from '@lib/hooks/useEvaluationInitialization'
import useEvaluationSettingsInitialization from '@lib/hooks/useEvaluationSettingsInitialization'
import { useSessionStorage } from '@uidotdev/usehooks'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Rank1Img from 'public/img/rank1.svg'
import Rank2Img from 'public/img/rank2.svg'
import Rank3Img from 'public/img/rank3.svg'
import { useEffect, useReducer, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ElementEvaluation from './ElementEvaluation'
import EvaluationFooter from './EvaluationFooter'
import EvaluationUnavailableNotification from './EvaluationUnavailableNotification'
import EvaluationConfusion from './feedbacks/EvaluationConfusion'
import EvaluationFeedbacks from './feedbacks/EvaluationFeedbacks'
import useChartTypeUpdate from './hooks/useChartTypeUpdate'
import useStackInstanceMap from './hooks/useStackInstanceMap'
import EvaluationNavigation from './navigation/EvaluationNavigation'
import { sizeReducer, TextSizes } from './textSizes'

export type ActivityEvaluationType = 'LiveQuiz' | 'Asynchronous'
export type ActiveStackType =
  | number
  | 'feedbacks'
  | 'confusion'
  | 'leaderboard'
  | 'escapeRoom'

interface ActivityEvaluationProps {
  courseId?: string | null
  activityId: string
  activityName: string
  courseLanguage?: LocaleType | null
  stacks: StackEvaluation[]
  feedbacks?: Feedback[] | null
  confusionFeedbacks?: ConfusionTimestep[] | null
  leaderboard?: LeaderboardCombinedEntry[] | null
  hideActiveBlockResults?: boolean
  isAssessmentEnabled?: boolean | null
  pinCode?: string | null
  type?: ActivityEvaluationType
  // when set, an "Escape Room" tab surfaces the per-participant progress
  // dashboard (owner-scoped query returns null for non-escape-room activities)
  escapeRoomActivityType?: 'practiceQuiz' | 'microLearning'
  canResetEscapeRoom?: boolean
}

function ActivityEvaluation({
  courseId,
  activityId,
  activityName,
  courseLanguage,
  stacks,
  feedbacks,
  confusionFeedbacks,
  leaderboard,
  isAssessmentEnabled = false,
  pinCode,
  hideActiveBlockResults = false,
  type = 'Asynchronous',
  escapeRoomActivityType,
  canResetEscapeRoom = false,
}: ActivityEvaluationProps) {
  const router = useRouter()
  const t = useTranslations()
  const [activeStack, setActiveStack] = useState<ActiveStackType>(0)
  const [activeInstance, setActiveInstance] = useState<number>(0)
  const [chartType, setChartType] = useState<ChartType>(ChartType.UNSET)
  const [textSize, setTextSize] = useReducer(sizeReducer, TextSizes['md'])

  // show solution and explanation settings based on session storage
  const [showSolution, setShowSolution] = useSessionStorage(
    `show-solution-${activityId}-${activeStack}-${activeInstance}`,
    false
  )
  const [showExplanation, setShowExplanation] = useSessionStorage(
    `show-explanation-${activityId}-${activeStack}-${activeInstance}`,
    false
  )

  const instanceResults = stacks.flatMap((stack, stackIx) =>
    stack.instances.map((instance) => ({
      ...instance,
      stackIx,
    }))
  )

  // automatically switch to correct instance
  useEvaluationInitialization({
    setActiveInstance,
    setActiveStack,
    questionIx: router.query.questionIx as string | null,
    results: instanceResults,
    showLeaderboard: router.query.leaderboard === 'true',
    missingInstanceResults: instanceResults.length === 0,
    type,
  })

  // automatically use correct settings depending on URL params
  useEvaluationSettingsInitialization({
    setShowSolution,
    setShowExplanation,
    paramsLoaded:
      typeof router.query.questionIx !== 'undefined' &&
      parseInt(router.query.questionIx as string) === activeInstance,
    showSolution: router.query.showSolution === 'true',
    showExplanation: router.query.showExplanation === 'true',
    activeInstance,
    activeStack,
  })

  // compute a map between stack and instance indices {stackIx: [instanceIx1, instanceIx2], ...}
  const stackInstanceMap = useStackInstanceMap({ stacks })

  // escape-room monitoring: the owner-scoped query returns null for
  // non-escape-room activities, so the tab only appears when data is present.
  const {
    data: escapeRoomData,
    error: escapeRoomError,
    refetch: refetchEscapeRoom,
    startPolling: startEscapeRoomPolling,
    stopPolling: stopEscapeRoomPolling,
  } = useQuery(GetEscapeRoomProgressDocument, {
    variables:
      escapeRoomActivityType === 'microLearning'
        ? { microLearningId: activityId }
        : { practiceQuizId: activityId },
    skip: !escapeRoomActivityType,
  })
  const escapeRoomProgress = escapeRoomData?.escapeRoomProgress ?? null
  const escapeRoomAvailable = escapeRoomProgress !== null

  // only poll while the lecturer is actively viewing the escape-room tab
  useEffect(() => {
    if (escapeRoomAvailable && activeStack === 'escapeRoom') {
      startEscapeRoomPolling(5000)
      return () => stopEscapeRoomPolling()
    }
    stopEscapeRoomPolling()
  }, [
    escapeRoomAvailable,
    activeStack,
    startEscapeRoomPolling,
    stopEscapeRoomPolling,
  ])

  // update the chart type as soon as the active instance changes
  useChartTypeUpdate({
    activeInstance,
    activeElementType: instanceResults[activeInstance]?.type,
    chartType,
    setChartType,
  })

  if (
    typeof activeStack === 'number' &&
    typeof instanceResults[activeInstance] === 'undefined'
  ) {
    return <EvaluationUnavailableNotification />
  }

  return (
    <>
      <Head>
        <title>{`KlickerUZH - Evaluation: ${activityName}`}</title>
        <meta
          name="description"
          content={`KlickerUZH - Evaluation: ${activityName}`}
          charSet="utf-8"
        ></meta>
      </Head>

      {router.query.hideControls !== 'true' && (
        <div className="z-20 h-11 flex-none">
          <EvaluationNavigation
            courseId={courseId ?? ''}
            activityId={activityId}
            stacks={stacks}
            stackInstanceMap={stackInstanceMap}
            activeStack={activeStack}
            setActiveStack={setActiveStack}
            activeInstance={activeInstance}
            setActiveInstance={setActiveInstance}
            numOfInstances={instanceResults.length}
            type={type}
            leaderboardAvailable={leaderboard !== null}
            feedbacksAvailable={
              feedbacks !== null && confusionFeedbacks !== null
            }
            escapeRoomAvailable={escapeRoomAvailable}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {escapeRoomError ? (
          <div className="flex flex-col items-start gap-2 p-4">
            <UserNotification
              type="error"
              message={t('shared.generic.systemError')}
            />
            <Button
              data-cy="escape-room-progress-retry"
              onClick={() => void refetchEscapeRoom()}
            >
              {t('shared.generic.tryAgain')}
            </Button>
          </div>
        ) : null}
        {instanceResults.length > 0 && typeof activeStack === 'number' && (
          <ElementEvaluation
            requireShowResultsConfirmation={
              hideActiveBlockResults && stacks[activeStack].stackActive
            }
            isStackActive={stacks[activeStack]?.stackActive ?? false}
            currentInstance={instanceResults[activeInstance]}
            currentStack={stacks[activeStack]}
            activeInstance={activeInstance}
            activeStack={activeStack}
            courseLanguage={courseLanguage}
            isAssessmentEnabled={isAssessmentEnabled ?? false}
            pinCode={pinCode}
            textSize={textSize}
            chartType={chartType}
            showSolution={
              instanceResults[activeInstance]?.hasSampleSolution
                ? showSolution
                : false
            }
            showExplanation={
              instanceResults[activeInstance]?.explanation &&
              instanceResults[activeInstance]?.explanation !== '' &&
              !instanceResults[activeInstance]?.explanation.match(
                /^(<br>(\n)*)$/g
              )
                ? showExplanation
                : false
            }
            type={type}
          />
        )}

        {type === 'LiveQuiz' &&
          leaderboard !== null &&
          activeStack === 'leaderboard' && (
            <div className="overflow-y-auto">
              <div className="border-t p-4">
                <div className="mx-auto max-w-2xl text-xl">
                  {leaderboard && leaderboard.length > 0 ? (
                    <Leaderboard
                      leaderboard={leaderboard ?? []}
                      podiumImgSrc={{
                        rank1: Rank1Img,
                        rank2: Rank2Img,
                        rank3: Rank3Img,
                      }}
                    />
                  ) : (
                    <UserNotification
                      className={{ message: 'text-lg' }}
                      type="warning"
                      message={t('manage.evaluation.noSignedInStudents')}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

        {type === 'LiveQuiz' &&
          feedbacks !== null &&
          activeStack === 'feedbacks' && (
            <div className="overflow-y-auto print:overflow-y-visible">
              <div className="p-4">
                <div className="mx-auto max-w-5xl text-xl">
                  {feedbacks && feedbacks.length > 0 ? (
                    <EvaluationFeedbacks
                      feedbacks={feedbacks}
                      liveQuizName={activityName}
                    />
                  ) : (
                    <UserNotification
                      className={{ message: 'text-lg' }}
                      type="warning"
                      message={t('manage.evaluation.noFeedbacksYet')}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

        {type === 'LiveQuiz' &&
          confusionFeedbacks !== null &&
          activeStack === 'confusion' && (
            <div className="overflow-y-auto">
              <div className="border-t p-4">
                <div className="mx-auto max-w-5xl text-xl">
                  {confusionFeedbacks && confusionFeedbacks.length > 0 ? (
                    <EvaluationConfusion confusionTS={confusionFeedbacks} />
                  ) : (
                    <UserNotification
                      className={{ message: 'text-lg' }}
                      type="warning"
                      message={t('manage.evaluation.noConfusionFeedbacksYet')}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

        {escapeRoomActivityType &&
          escapeRoomProgress !== null &&
          activeStack === 'escapeRoom' && (
            <EscapeRoomProgress
              activityType={escapeRoomActivityType}
              activityId={activityId}
              progress={escapeRoomProgress}
              onReset={refetchEscapeRoom}
              canReset={canResetEscapeRoom}
            />
          )}
      </div>

      <div
        className={twMerge(
          'z-20 h-max flex-none',
          (activeStack === 'feedbacks' ||
            activeStack === 'confusion' ||
            activeStack === 'leaderboard' ||
            activeStack === 'escapeRoom') &&
            'h-[2.3rem]'
        )}
      >
        <EvaluationFooter
          type={type}
          activeStack={activeStack}
          isStackActive={
            typeof activeStack === 'number'
              ? (stacks[activeStack]?.stackActive ?? false)
              : false
          }
          textSize={textSize}
          setTextSize={setTextSize}
          showSolution={showSolution}
          setShowSolution={setShowSolution}
          showExplanation={showExplanation}
          setShowExplanation={setShowExplanation}
          chartType={chartType}
          setChartType={setChartType}
          currentInstance={instanceResults[activeInstance]}
        />
      </div>
    </>
  )
}

export default ActivityEvaluation
