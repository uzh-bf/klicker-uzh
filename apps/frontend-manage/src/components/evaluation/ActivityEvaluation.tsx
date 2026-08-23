import {
  ConfusionTimestep,
  Feedback,
  LocaleType,
  PublicationStatus,
  StackEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import Leaderboard, {
  LeaderboardCombinedEntry,
} from '@klicker-uzh/shared-components/src/Leaderboard'
import { useSessionStorage } from '@uidotdev/usehooks'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Rank1Img from 'public/img/rank1.svg'
import Rank2Img from 'public/img/rank2.svg'
import Rank3Img from 'public/img/rank3.svg'
import { useReducer, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import useEvaluationInitialization from '../../lib/hooks/useEvaluationInitialization'
import useEvaluationSettingsInitialization from '../../lib/hooks/useEvaluationSettingsInitialization'
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
export type ActiveStackType = number | 'feedbacks' | 'confusion' | 'leaderboard'

interface ActivityEvaluationProps {
  courseId?: string | null
  courseName?: string | null
  activityId: string
  activityName: string
  activityStatus?: PublicationStatus
  courseLanguage?: LocaleType | null
  stacks: StackEvaluation[]
  feedbacks?: Feedback[] | null
  confusionFeedbacks?: ConfusionTimestep[] | null
  leaderboard?: LeaderboardCombinedEntry[] | null
  hideActiveBlockResults?: boolean
  isAssessmentEnabled?: boolean | null
  pinCode?: string | null
  type?: ActivityEvaluationType
  lastRefetchTime?: Date
}

function ActivityEvaluation({
  courseId,
  courseName,
  activityId,
  activityName,
  activityStatus,
  courseLanguage,
  stacks,
  feedbacks,
  confusionFeedbacks,
  leaderboard,
  isAssessmentEnabled = false,
  pinCode,
  hideActiveBlockResults = false,
  type = 'Asynchronous',
  lastRefetchTime,
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
    return (
      <EvaluationUnavailableNotification
        courseName={courseName}
        activityName={activityName}
        activityId={activityId}
        activityStatus={activityStatus}
      />
    )
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
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
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
            courseId={courseId}
            courseName={courseName}
            activityName={activityName}
            activityId={activityId}
            activityStatus={activityStatus}
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
            lastRefetchTime={lastRefetchTime}
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
      </div>

      <div
        className={twMerge(
          'z-20 h-max flex-none',
          (activeStack === 'feedbacks' ||
            activeStack === 'confusion' ||
            activeStack === 'leaderboard') &&
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
