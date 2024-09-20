import {
  sizeReducer,
  TextSizes,
} from '@components/sessions/evaluation/constants'
import { StackEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useReducer, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ElementEvaluation from './ElementEvaluation'
import EvaluationFooter from './EvaluationFooter'
import useChartTypeUpdate from './hooks/useChartTypeUpdate'
import useStackInstanceMap from './hooks/useStackInstanceMap'
import EvaluationNavigation from './navigation/EvaluationNavigation'

interface ActivityEvaluationProps {
  activityName: string
  stacks: StackEvaluation[]
}

export type ActiveStackType = number | 'feedbacks' | 'confusion' | 'leaderboard'

function ActivityEvaluation({ activityName, stacks }: ActivityEvaluationProps) {
  const router = useRouter()
  const [activeStack, setActiveStack] = useState<ActiveStackType>(0)
  const [activeInstance, setActiveInstance] = useState<number>(0)
  const [showSolution, setShowSolution] = useState<boolean>(false)
  const [chartType, setChartType] = useState<ChartType>(ChartType.UNSET)
  const [textSize, setTextSize] = useReducer(sizeReducer, TextSizes['md'])

  const instanceResults = stacks.flatMap((stack) => stack.instances)

  // compute a map between stack and instance indices {stackIx: [instanceIx1, instanceIx2], ...}
  const stackInstanceMap = useStackInstanceMap({ stacks })

  // update the chart type as soon as the active instance changes
  useChartTypeUpdate({
    activeInstance,
    activeElementType: instanceResults[activeInstance].type,
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
          />
        )}

        {/* {showLeaderboard && !showConfusion && !showFeedbacks && (
          <div className="overflow-y-auto">
            <div className="border-t p-4">
              <div className="mx-auto max-w-2xl text-xl">
                {data.sessionLeaderboard &&
                data.sessionLeaderboard.length > 0 ? (
                  <Leaderboard
                    leaderboard={data.sessionLeaderboard ?? []}
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
        )} */}

        {/* {!showLeaderboard &&
          !showConfusion &&
          showFeedbacks &&
          data.sessionEvaluation && (
            <div className="overflow-y-auto print:overflow-y-visible">
              <div className="p-4">
                <div className="mx-auto max-w-5xl text-xl">
                  {feedbacks && feedbacks.length > 0 ? (
                    <EvaluationFeedbacks
                      feedbacks={feedbacks}
                      sessionName={data.sessionEvaluation.displayName}
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
          )} */}

        {/* {!showLeaderboard && showConfusion && !showFeedbacks && (
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
        )} */}
      </div>

      <div
        className={twMerge(
          'z-20 h-14 flex-none',
          (activeStack === 'feedbacks' ||
            activeStack === 'confusion' ||
            activeStack === 'leaderboard') &&
            'h-18'
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
