import { useQuery } from '@apollo/client'
import { faFont, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetSessionEvaluationDocument,
  GetSessionEvaluationQuery,
  InstanceResult,
  SessionBlockStatus,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  Switch,
  ThemeContext,
  UserNotification,
} from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useReducer, useState } from 'react'
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

function Evaluation() {
  const router = useRouter()
  const theme = useContext(ThemeContext)

  const [selectedBlock, setSelectedBlock] = useState<number>(0)
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

  const { blocks, feedbacks, confusionFeedbacks, isGamificationEnabled } =
    data?.sessionEvaluation || {
      blocks: [],
      feedbacks: [],
      confusionFeedbacks: [],
      isGamificationEnabled: false,
    }

  const instanceResults = useMemo(() => {
    return data?.sessionEvaluation?.instanceResults ?? []
  }, [data])

  useEvaluationInitialization({
    selectedInstance,
    instanceResults,
    currentInstance,
    chartType,
    setSelectedInstance,
    setCurrentInstance,
    setSelectedInstanceIndex,
    setChartType,
  })

  // if a question index is provided through the url, directly switch to this question
  useEffect(() => {
    const ix = parseInt(String(router.query.questionIx))
    if (typeof ix === 'number' && instanceResults[ix]) {
      setSelectedInstance(instanceResults[ix].id)
      setSelectedBlock(instanceResults[ix].blockIx)
    }
  }, [router.query.questionIx, instanceResults])

  if (error && !data)
    return <div>An error occurred, please try again later.</div>
  if (loading || !data) return <div>Loading...</div>

  return (
    <div className="flex flex-col h-full overflow-y-none">
      <EvaluationControlBar
        blocks={blocks || []}
        selectedBlock={selectedBlock}
        setSelectedBlock={setSelectedBlock}
        setSelectedInstance={setSelectedInstance}
        selectedInstance={selectedInstance}
        selectedInstanceIndex={selectedInstanceIndex}
        instanceResults={instanceResults}
        setLeaderboard={setLeaderboard}
        setFeedbacks={setFeedbacks}
        setConfusion={setConfusion}
        showLeaderboard={showLeaderboard}
        showFeedbacks={showFeedbacks}
        showConfusion={showConfusion}
        status={status}
        feedbacks={feedbacks || []}
        confusionFeedbacks={confusionFeedbacks || []}
        isGamificationEnabled={isGamificationEnabled}
      />

      <div className="flex-1 overflow-y-auto">
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
          <div>
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
          <div>
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
          <div>
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

      <Footer
        className={twMerge(
          'relative flex-none h-14',
          (showFeedbacks || showConfusion || showLeaderboard) && 'h-18'
        )}
      >
        {currentInstance &&
          !showFeedbacks &&
          !showConfusion &&
          !showLeaderboard && (
            <div className="flex flex-row items-center justify-between px-4 py-2.5 pr-8 m-0">
              <div className="text-lg" id="session-total-participants">
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
  )
}

export default Evaluation
