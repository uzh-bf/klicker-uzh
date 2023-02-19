import { useQuery } from '@apollo/client'
import { faFont, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Block,
  GetSessionEvaluationDocument,
  GetSessionEvaluationQuery,
  InstanceResult,
  SessionBlockStatus,
  TabData,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  Switch,
  useArrowNavigation,
  UserNotification,
} from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useReducer, useState } from 'react'
import Leaderboard from 'shared-components/src/Leaderboard'
import { twMerge } from 'tailwind-merge'
import Footer from '../../../components/common/Footer'
import useEvaluationInitialization from '../../../components/hooks/useEvaluationInitialization'
import {
  sizeReducer,
  TextSizes,
} from '../../../components/sessions/evaluation/constants'
import EvaluationConfusion from '../../../components/sessions/evaluation/EvaluationConfusion'
import EvaluationControlBar from '../../../components/sessions/evaluation/EvaluationControlBar'
import EvaluationFeedbacks from '../../../components/sessions/evaluation/EvaluationFeedbacks'
import QuestionEvaluation from '../../../components/sessions/evaluation/QuestionEvaluation'

export type EvaluationTabData = TabData & { ix: number }
export type EvaluationBlock = Omit<Block, 'tabData'> & {
  tabData: EvaluationTabData[]
}

function Evaluation() {
  const router = useRouter()

  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number>(0)
  const [showLeaderboard, setLeaderboard] = useState<boolean>(false)
  const [showFeedbacks, setFeedbacks] = useState<boolean>(false)
  const [showConfusion, setConfusion] = useState<boolean>(false)
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [selectedInstanceIndex, setSelectedInstanceIndex] = useState<number>(0)
  const [showSolution, setShowSolution] = useState<boolean>(false)
  const [chartType, setChartType] = useState<string>('')

  const [currentInstance, setCurrentInstance] = useState<InstanceResult>({
    blockIx: 0,
    id: '',
    instanceIx: 0,
    participants: 0,
    questionData: {
      id: 0,
      name: '',
      content: '',
      type: 'SC',
      options: { choices: [] },
    },
    results: {},
    statistics: {},
    status: SessionBlockStatus.Executed,
  })

  const [textSize, settextSize] = useReducer(sizeReducer, TextSizes['md'])

  const {
    data,
    loading,
    error,
  }: {
    data: GetSessionEvaluationQuery | undefined
    loading: any
    error?: any
  } = useQuery(GetSessionEvaluationDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 5000,
    skip: !router.query.id,
  })

  const {
    blocks: blockData,
    feedbacks,
    confusionFeedbacks,
    isGamificationEnabled,
    status,
  } = data?.sessionEvaluation || {
    blocks: [],
    feedbacks: [],
    confusionFeedbacks: [],
    isGamificationEnabled: false,
  }

  const instanceResults = useMemo(() => {
    return (
      data?.sessionEvaluation?.instanceResults?.map((result, ix) => ({
        ...result,
        ix,
      })) ?? []
    )
  }, [data])

  const { blocks } = useMemo(() => {
    if (!blockData) return { blocks: [] }

    return blockData.reduce(
      (acc: { ix: number; blocks: EvaluationBlock[] }, block: Block) => {
        const mappedBlock = {
          ...block,
          tabData: block.tabData?.map((instance, ix) => ({
            ...instance,
            ix: ix + acc.ix,
          })),
        }

        return {
          ix: acc.ix + (block.tabData?.length || 0),
          blocks: [...acc.blocks, mappedBlock],
        }
      },
      {
        ix: 0,
        blocks: [],
      }
    ) as { ix: number; blocks: EvaluationBlock[] }
  }, [blockData])

  useEvaluationInitialization({
    selectedInstanceIndex,
    instanceResults,
    chartType,
    questionIx: Number(router.query.questionIx ?? 0),
    setSelectedInstance,
    setCurrentInstance,
    setSelectedInstanceIndex,
    setChartType,
    setSelectedBlockIndex,
  })

  useArrowNavigation({
    onArrowLeft: () => {
      if (selectedInstanceIndex > 0 && selectedInstanceIndex !== -1) {
        setSelectedInstanceIndex(selectedInstanceIndex - 1)
      }
    },
    onArrowRight: () => {
      if (
        selectedInstanceIndex < instanceResults.length - 1 &&
        selectedInstanceIndex !== -1
      ) {
        setSelectedInstanceIndex(selectedInstanceIndex + 1)
      }
    },
  })

  useEffect(() => {
    if (router.query.leaderboard === 'true') {
      setLeaderboard(true)
      setConfusion(false)
      setFeedbacks(false)
      setSelectedBlockIndex(-1)
      setSelectedInstanceIndex(-1)
    }
  }, [router.query.leaderboard])

  if (error && !data)
    return <div>An error occurred, please try again later.</div>
  if (loading || !data) return <div>Loading...</div>

  if (!currentInstance.id && selectedInstanceIndex !== -1) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <UserNotification
          className={{
            root: 'max-w-[80%] lg:max-w-[60%] 2xl:max-w-[50%] text-lg',
          }}
          message="Die Evaluation zu dieser Frage kann leider (noch) nicht angezeigt werden. Sollten Sie diese Seite irgendwo einbinden wollen, beispielsweise über das PowerPoint-Plugin, wird die Evaluation automatisch nach Starten der Frage angezeigt."
        />
      </div>
    )
  }

  return (
    <>
      <div className="z-20 flex-none h-11">
        <EvaluationControlBar
          blocks={blocks || []}
          selectedBlock={selectedBlockIndex}
          setSelectedBlock={setSelectedBlockIndex}
          setSelectedInstanceIndex={setSelectedInstanceIndex}
          selectedInstanceIndex={selectedInstanceIndex}
          instanceResults={instanceResults}
          setLeaderboard={setLeaderboard}
          setFeedbacks={setFeedbacks}
          setConfusion={setConfusion}
          showLeaderboard={showLeaderboard}
          showFeedbacks={showFeedbacks}
          showConfusion={showConfusion}
          status={status || ''}
          feedbacks={feedbacks || []}
          confusionFeedbacks={confusionFeedbacks || []}
          isGamificationEnabled={isGamificationEnabled}
        />
      </div>

      <div className={twMerge('flex-1 flex flex-col min-h-0')}>
        {currentInstance &&
          !showConfusion &&
          !showFeedbacks &&
          !showLeaderboard && (
            <QuestionEvaluation
              currentInstance={currentInstance}
              selectedInstance={selectedInstance}
              showSolution={showSolution}
              textSize={textSize}
              chartType={chartType}
              setChartType={setChartType}
            />
          )}

        {showLeaderboard && !showConfusion && !showFeedbacks && (
          <div className="overflow-y-auto">
            <div className="p-4 border-t">
              <div className="max-w-5xl mx-auto text-xl">
                {data.sessionLeaderboard &&
                data.sessionLeaderboard.length > 0 ? (
                  <div className="mt-6">
                    <Leaderboard
                      leaderboard={data.sessionLeaderboard}
                      className={{
                        podiumSingle: 'text-lg',
                        listItem: 'text-lg',
                      }}
                    />
                  </div>
                ) : (
                  <UserNotification
                    className={{ message: 'text-lg' }}
                    notificationType="error"
                    message="Bisher waren keine Teilnehmenden während dieser Session
              angemeldet und haben Punkte gesammelt."
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {!showLeaderboard && !showConfusion && showFeedbacks && (
          <div className="overflow-y-auto">
            <div className="p-4 border-t">
              <div className="max-w-5xl mx-auto text-xl">
                {feedbacks && feedbacks.length > 0 ? (
                  <EvaluationFeedbacks feedbacks={feedbacks} />
                ) : (
                  <UserNotification
                    className={{ message: 'text-lg' }}
                    notificationType="error"
                    message="Diese Session enthält bisher keine Feedbacks."
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {!showLeaderboard && showConfusion && !showFeedbacks && (
          <div className="overflow-y-auto">
            <div className="p-4 border-t">
              <div className="max-w-5xl mx-auto text-xl">
                {confusionFeedbacks && confusionFeedbacks.length > 0 ? (
                  <EvaluationConfusion confusionTS={confusionFeedbacks} />
                ) : (
                  <UserNotification
                    className={{ message: 'text-lg' }}
                    notificationType="error"
                    message="Diese Session enthält bisher keine Confusion Feedbacks."
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className={twMerge(
          'flex-none h-14 z-20',
          (showFeedbacks || showConfusion || showLeaderboard) && 'h-18'
        )}
      >
        <Footer>
          {currentInstance &&
            !showFeedbacks &&
            !showConfusion &&
            !showLeaderboard && (
              <div className="flex flex-row items-center justify-between px-4 py-2.5 pr-8 m-0">
                <div className="text-lg" data-cy="session-total-participants">
                  Total Teilnehmende: {currentInstance.participants}
                </div>
                <div className="flex flex-row items-center gap-5">
                  <Switch
                    checked={showSolution}
                    label="Lösung anzeigen"
                    onCheckedChange={(newValue) => setShowSolution(newValue)}
                  />
                  <div className="flex flex-row items-center gap-2 ml-2">
                    <Button
                      onClick={() => {
                        settextSize({ type: 'decrease' })
                      }}
                      disabled={textSize.size === 'sm'}
                    >
                      <Button.Icon>
                        <FontAwesomeIcon icon={faMinus} />
                      </Button.Icon>
                    </Button>
                    <Button
                      onClick={() => {
                        settextSize({ type: 'increase' })
                      }}
                      disabled={textSize.size === 'xl'}
                    >
                      <Button.Icon>
                        <FontAwesomeIcon icon={faPlus} />
                      </Button.Icon>
                    </Button>
                    <FontAwesomeIcon icon={faFont} size="lg" />
                    Schriftgrösse
                  </div>
                </div>
              </div>
            )}
        </Footer>
      </div>

      <style jsx global>{`
        #__app {
           {
            /* max-height: 100%; */
          }
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </>
  )
}

export default Evaluation
