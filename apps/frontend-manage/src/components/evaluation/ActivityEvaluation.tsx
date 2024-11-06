import {
  ConfusionTimestep,
  Feedback,
  StackEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import Leaderboard, {
  LeaderboardCombinedEntry,
} from '@klicker-uzh/shared-components/src/Leaderboard'
import useEvaluationInitialization from '@lib/hooks/useEvaluationInitialization'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Rank1Img from 'public/img/rank1.svg'
import Rank2Img from 'public/img/rank2.svg'
import Rank3Img from 'public/img/rank3.svg'
import { useReducer, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ElementEvaluation from './ElementEvaluation'
import EvaluationFooter from './EvaluationFooter'
import EvaluationConfusion from './feedbacks/EvaluationConfusion'
import EvaluationFeedbacks from './feedbacks/EvaluationFeedbacks'
import useChartTypeUpdate from './hooks/useChartTypeUpdate'
import useStackInstanceMap from './hooks/useStackInstanceMap'
import EvaluationNavigation from './navigation/EvaluationNavigation'
import { sizeReducer, TextSizes } from './textSizes'

export type ActivityEvaluationType = 'LiveQuiz' | 'Asynchronous'
export type ActiveStackType = number | 'feedbacks' | 'confusion' | 'leaderboard'

interface ActivityEvaluationProps {
  activityName: string
  stacks: StackEvaluation[]
  feedbacks?: Feedback[] | null
  confusionFeedbacks?: ConfusionTimestep[] | null
  leaderboard?: LeaderboardCombinedEntry[] | null
  type?: ActivityEvaluationType
}

function ActivityEvaluation({
  activityName,
  stacks,
  feedbacks,
  confusionFeedbacks,
  leaderboard,
  type = 'Asynchronous',
}: ActivityEvaluationProps) {
  const router = useRouter()
  const t = useTranslations()
  const [activeStack, setActiveStack] = useState<ActiveStackType>(0)
  const [activeInstance, setActiveInstance] = useState<number>(0)
  const [showSolution, setShowSolution] = useState<boolean>(false)
  const [chartType, setChartType] = useState<ChartType>(ChartType.UNSET)
  const [textSize, setTextSize] = useReducer(sizeReducer, TextSizes['md'])

  const instanceResults = stacks.flatMap((stack) => stack.instances)

  // automatically switch to correct instance and use correct settings depending on URL params
  useEvaluationInitialization({
    setActiveInstance,
    setActiveStack,
    setShowSolution,
    questionIx: router.query.questionIx as string | null,
    showLeaderboard: router.query.leaderboard === 'true',
    showSolution: router.query.showSolution === 'true',
    type,
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
        {typeof activeStack === 'number' && (
          <ElementEvaluation
            currentInstance={instanceResults[activeInstance]}
            activeInstance={activeInstance}
            textSize={textSize}
            chartType={chartType}
            showSolution={
              instanceResults[activeInstance].hasSampleSolution
                ? showSolution
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
                      sessionName={activityName}
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
          'h-18 z-20 flex-none',
          (activeStack === 'feedbacks' ||
            activeStack === 'confusion' ||
            activeStack === 'leaderboard') &&
            'h-14'
        )}
      >
        <EvaluationFooter
          activeStack={activeStack}
          textSize={textSize}
          setTextSize={setTextSize}
          showSolution={showSolution}
          setShowSolution={setShowSolution}
          chartType={chartType}
          setChartType={setChartType}
          currentInstance={instanceResults[activeInstance]}
        />
      </div>
    </>
  )
}

export default ActivityEvaluation
