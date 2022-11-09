import { useQuery } from '@apollo/client'
import EvaluationConfusion from '@components/sessions/evaluation/EvaluationConfusion'
import EvaluationFeedbacks from '@components/sessions/evaluation/EvaluationFeedbacks'
import {
  faCheck,
  faComment,
  faFaceSmile,
  faGamepad,
  faSync,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChoicesQuestionOptions,
  FreeTextQuestionOptions,
  GetSessionEvaluationDocument,
  GetSessionEvaluationQuery,
  NumericalQuestionOptions,
  SessionBlockStatus,
  Statistics,
} from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import * as RadixTab from '@radix-ui/react-tabs'
import { Prose, Select, Switch, UserNotification } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import {
  ACTIVE_CHART_TYPES,
  CHART_COLORS,
} from 'shared-components/src/constants'
import SessionLeaderboard from 'shared-components/src/SessionLeaderboard'
import { twMerge } from 'tailwind-merge'
import Footer from '../../../components/common/Footer'
import Chart from '../../../components/evaluation/Chart'

// TODO: maybe move this util to another file / component or to this component - having util files in the components seems strange?

const INSTANCE_STATUS_ICON: Record<string, IconDefinition> = {
  EXECUTED: faCheck,
  ACTIVE: faSync,
}

function Evaluation() {
  const router = useRouter()

  const [selectedBlock, setSelectedBlock] = useState(0)
  const [selectedInstance, setSelectedInstance] = useState('')
  const [showSolution, setShowSolution] = useState(false)
  const [chartType, setChartType] = useState<string>('table')
  const [currentInstance, setCurrentInstance] = useState<{
    blockIx: number
    id: string
    instanceIx: number
    participants: number
    questionData:
      | {
          id: number
          name: string
          content: string
          type: 'SC' | 'MC' | 'KPRIM'
          options: ChoicesQuestionOptions
        }
      | {
          id: number
          name: string
          content: string
          type: 'NUMERICAL'
          options: NumericalQuestionOptions
        }
      | {
          id: number
          name: string
          content: string
          type: 'FREE_TEXT'
          options: FreeTextQuestionOptions
        }
    results: Object
    statistics: Statistics
    status: SessionBlockStatus
  }>({
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

  const blocks = useMemo(() => {
    return data?.sessionEvaluation?.blocks ?? []
  }, [data])

  const instanceResults = useMemo(() => {
    return data?.sessionEvaluation?.instanceResults ?? []
  }, [data])

  const tabs = useMemo(
    () =>
      blocks.map((block) => {
        return {
          label: 'Block ' + String(block.blockIx + 1),
          value: block.blockIx,
        }
      }),
    [blocks]
  )

  const selectData = useMemo(() => {
    if (!blocks || !blocks[selectedBlock]) return []
    return blocks[selectedBlock].tabData?.map((question) => {
      return { label: question?.name || '', value: question?.id || '' }
    })
  }, [blocks, selectedBlock])

  useEffect(() => {
    if (!instanceResults || instanceResults.length === 0) return

    if (selectedInstance === '' && currentInstance.id === '') {
      setSelectedInstance(instanceResults[0].id)
      setCurrentInstance(instanceResults[0])
    }

    const currInstance = instanceResults?.find(
      (instance) => instance.id === selectedInstance
    )
    if (currInstance) setCurrentInstance(currInstance)

    const possibleChartTypes = ACTIVE_CHART_TYPES[
      currentInstance?.questionData.type
    ].map((type) => type.value)

    if (!possibleChartTypes.includes(chartType)) {
      setChartType(
        ACTIVE_CHART_TYPES[currentInstance?.questionData.type][0].value
      )
    }
  }, [
    selectedInstance,
    instanceResults,
    currentInstance.id,
    chartType,
    currentInstance.questionData.type,
  ])

  if (error && !data)
    return <div>An error occurred, please try again later.</div>
  if (loading || !data) return <div>Loading...</div>

  // TODO: think about mobile layout (maybe at least tablet support)
  return (
    <RadixTab.Root
      className="flex flex-col h-full overflow-y-none"
      defaultValue="0"
    >
      <RadixTab.List className="flex flex-row flex-none px-3 bg-white border-b-2 border-solid justify-betweenb h-11 print:hidden">
        {blocks && blocks[selectedBlock] && (
          <div className="flex flex-row items-center gap-2">
            <div className="font-bold">Frage:</div>

            <Select
              items={selectData || []}
              onChange={(newValue) => setSelectedInstance(newValue)}
              className={{
                root: 'h-11 z-20',
                trigger:
                  'shadow-sm rounded-none m-0 border-none hover:bg-uzh-blue-20',
              }}
              value={
                selectedInstance === ''
                  ? blocks[selectedBlock].tabData[0].id
                  : selectedInstance
              }
            />
          </div>
        )}
        <div className="ml-auto">
          {tabs.map((tab, idx) => (
            <RadixTab.Trigger
              key={tab.value}
              value={String(tab.value)}
              onClick={() => {
                setSelectedBlock(idx)
                setSelectedInstance(blocks[idx].tabData[0].id)
              }}
              className={twMerge(
                'px-3 py-2 border-b-2 border-transparent hover:bg-uzh-blue-20',
                idx === selectedBlock && 'border-solid border-uzh-blue-80'
              )}
            >
              <div className="flex flex-row items-center gap-2">
                <FontAwesomeIcon
                  size="xs"
                  icon={INSTANCE_STATUS_ICON[blocks[idx].tabData[0].status]}
                />
                <div>{tab.label}</div>
              </div>
            </RadixTab.Trigger>
          ))}
          {data.sessionEvaluation?.isGamificationEnabled && (
            <RadixTab.Trigger
              value="leaderboard"
              className={twMerge(
                'px-3 py-2 border-b-2 border-transparent hover:bg-uzh-blue-20',
                selectedBlock === tabs.length &&
                  'border-solid border-uzh-blue-80'
              )}
              onClick={() => {
                setSelectedBlock(tabs.length)
              }}
            >
              <div className="flex flex-row items-center gap-2">
                <div>
                  <FontAwesomeIcon icon={faGamepad} />
                </div>
                <div>Leaderboard</div>
              </div>
            </RadixTab.Trigger>
          )}

          {data.sessionEvaluation?.status === 'COMPLETED' &&
            data.sessionEvaluation?.feedbacks?.length !== 0 && (
              <RadixTab.Trigger
                value="feedbacks"
                className={twMerge(
                  'px-3 py-2 border-b-2 border-transparent hover:bg-uzh-blue-20',
                  selectedBlock === tabs.length + 1 &&
                    'border-solid border-uzh-blue-80'
                )}
                onClick={() => {
                  setSelectedBlock(tabs.length + 1)
                }}
              >
                <div className="flex flex-row items-center gap-2">
                  <div>
                    <FontAwesomeIcon icon={faComment} />
                  </div>
                  <div>Feedbacks</div>
                </div>
              </RadixTab.Trigger>
            )}
          {data.sessionEvaluation?.status === 'COMPLETED' &&
            data.sessionEvaluation?.confusionFeedbacks?.length !== 0 && (
              <RadixTab.Trigger
                value="confusion"
                className={twMerge(
                  'px-3 py-2 border-b-2 border-transparent hover:bg-uzh-blue-20',
                  selectedBlock === tabs.length + 2 &&
                    'border-solid border-uzh-blue-80'
                )}
                onClick={() => {
                  setSelectedBlock(tabs.length + 2)
                }}
              >
                <div className="flex flex-row items-center gap-2">
                  <div>
                    <FontAwesomeIcon icon={faFaceSmile} />
                  </div>
                  <div>Confusion</div>
                </div>
              </RadixTab.Trigger>
            )}
        </div>
      </RadixTab.List>

      <div className="flex-1 overflow-y-auto">
        {currentInstance && (
          <RadixTab.Content value={String(currentInstance.blockIx)}>
            <div>
              <Prose className="flex-initial prose-xl border-b prose-p:m-0 max-w-none">
                <Markdown
                  className="flex flex-row content-between p-2"
                  content={currentInstance.questionData.content}
                />
              </Prose>

              <div className="flex flex-col flex-1 md:flex-row">
                <div className="z-10 flex-1 order-2 md:order-1">
                  <Chart
                    chartType={chartType}
                    data={currentInstance}
                    showSolution={showSolution}
                  />
                </div>
                <div className="flex-initial order-1 w-64 p-4 border-l md:order-2">
                  <div className="flex flex-col gap-2">
                    <div className="font-bold">Diagramm Typ:</div>
                    <Select
                      className={{ root: '-mt-1 mb-1' }}
                      items={
                        ACTIVE_CHART_TYPES[currentInstance.questionData.type]
                      }
                      value={chartType}
                      onChange={(newValue: string) => setChartType(newValue)}
                    />

                    {(currentInstance.questionData.type === 'SC' ||
                      currentInstance.questionData.type === 'MC' ||
                      currentInstance.questionData.type === 'KPRIM') && (
                      <div className="flex flex-col gap-2">
                        <div className="font-bold">Antwortmöglichkeiten</div>
                        {currentInstance.questionData.options.choices.map(
                          (choice, innerIndex) => (
                            <div
                              key={`${currentInstance.blockIx}-${innerIndex}`}
                              className="flex flex-row"
                            >
                              <div
                                // TODO: possibly use single color for answer options to highlight correct one? or some other approach to distinguish better
                                style={{
                                  backgroundColor:
                                    choice.correct && showSolution
                                      ? '#00de0d'
                                      : CHART_COLORS[innerIndex % 12],
                                }}
                                className={twMerge(
                                  'mr-2 text-center rounded-md w-7 h-7 text-white font-bold',
                                  choice.correct && showSolution && 'text-black'
                                )}
                              >
                                {String.fromCharCode(65 + innerIndex)}
                              </div>
                              <Markdown
                                content={choice.value}
                                className="w-[calc(100%-3rem)]"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {currentInstance.questionData.type === 'NUMERICAL' && (
                      <div>
                        <div className="font-bold">
                          Erlaubter Antwortbereich:
                        </div>
                        <div>
                          [
                          {currentInstance.questionData.options.restrictions
                            ?.min ?? '-∞'}
                          ,
                          {currentInstance.questionData.options.restrictions
                            ?.max ?? '+∞'}
                          ]
                        </div>
                        <div className="mt-4 font-bold">Statistik:</div>
                        {Object.entries(currentInstance.statistics)
                          .slice(1)
                          .map((statistic, index) => {
                            return (
                              <div
                                key={index}
                                className="flex justify-between mb-2 border-b-2"
                              >
                                <span>{statistic[0]}</span>
                                <span>
                                  {Math.round(parseFloat(statistic[1]) * 100) /
                                    100}
                                </span>
                              </div>
                            )
                          })}
                        {showSolution &&
                          currentInstance.questionData.options
                            .solutionRanges && (
                            <div>
                              <div className="mt-4 font-bold">
                                Korrekte Lösungsbereiche:
                              </div>
                              {currentInstance.questionData.options.solutionRanges.map(
                                (range, innerIndex) => (
                                  <div key={innerIndex}>
                                    [{range?.min || '-∞'},{range?.max || '+∞'}]
                                  </div>
                                )
                              )}
                            </div>
                          )}
                      </div>
                    )}
                    {currentInstance.questionData.type === 'FREE_TEXT' &&
                      currentInstance.questionData.options.solutions &&
                      showSolution && (
                        <div>
                          <div className="font-bold">
                            Schlüsselwörter Lösung:
                          </div>
                          <ul>
                            {currentInstance.questionData.options.solutions.map(
                              (keyword, innerIndex) => (
                                <li key={innerIndex}>{`- ${keyword}`}</li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </RadixTab.Content>
        )}
        <RadixTab.Content value="leaderboard">
          <div className="p-4 border-t">
            <div className="max-w-5xl mx-auto text-xl">
              {data.sessionLeaderboard && data.sessionLeaderboard.length > 0 ? (
                <div className="mt-6">
                  <SessionLeaderboard
                    leaderboard={data.sessionLeaderboard}
                    className={{ podiumSingle: 'text-lg', listItem: 'text-lg' }}
                  />
                </div>
              ) : (
                <UserNotification
                  className="text-lg"
                  notificationType="error"
                  message="Bisher waren keine Teilnehmenden während dieser Session
              angemeldet und haben Punkte gesammelt."
                />
              )}
            </div>
          </div>
        </RadixTab.Content>

        <RadixTab.Content value="feedbacks">
          <div className="p-4 border-t">
            <div className="max-w-5xl mx-auto text-xl">
              {data.sessionEvaluation?.feedbacks &&
              data.sessionEvaluation?.feedbacks.length > 0 ? (
                <EvaluationFeedbacks
                  feedbacks={data.sessionEvaluation?.feedbacks}
                />
              ) : (
                <UserNotification
                  className="text-lg"
                  notificationType="error"
                  message="Diese Session enthält bisher keine Feedbacks."
                />
              )}
            </div>
          </div>
        </RadixTab.Content>

        <RadixTab.Content value="confusion">
          <div className="p-4 border-t">
            <div className="max-w-5xl mx-auto text-xl">
              {data.sessionEvaluation?.confusionFeedbacks &&
              data.sessionEvaluation?.confusionFeedbacks.length > 0 ? (
                <EvaluationConfusion
                  confusionTS={data.sessionEvaluation?.confusionFeedbacks}
                />
              ) : (
                <UserNotification
                  className="text-lg"
                  notificationType="error"
                  message="Diese Session enthält bisher keine Confusion Feedbacks."
                />
              )}
            </div>
          </div>
        </RadixTab.Content>
      </div>

      <Footer className="relative flex-none h-18">
        {currentInstance && (
          <div className="flex flex-row justify-between p-4 pr-8 m-0">
            <div className="text-xl">
              Total Teilnehmende: {currentInstance.participants}
            </div>
            <Switch
              id="showSolution"
              checked={showSolution}
              label="Lösung anzeigen"
              onCheckedChange={(newValue) => setShowSolution(newValue)}
            />
          </div>
        )}
      </Footer>
    </RadixTab.Root>
  )
}

export default Evaluation
