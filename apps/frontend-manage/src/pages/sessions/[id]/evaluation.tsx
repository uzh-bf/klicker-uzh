import { useQuery } from '@apollo/client'
import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
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
  InstanceResult,
  NumericalQuestionOptions,
  SessionBlockStatus,
  Statistics,
} from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import * as RadixTab from '@radix-ui/react-tabs'
import {
  Button,
  Prose,
  Select,
  Switch,
  UserNotification,
} from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import {
  ACTIVE_CHART_TYPES,
  CHART_COLORS,
  STATISTICS_ORDER,
} from 'shared-components/src/constants'
import Leaderboard from 'shared-components/src/Leaderboard'
import { twMerge } from 'tailwind-merge'
import Ellipsis from '../../../components/common/Ellipsis'
import Footer from '../../../components/common/Footer'
import Chart from '../../../components/evaluation/Chart'
import Statistic from '../../../components/evaluation/Statistic'
import EvaluationConfusion from '../../../components/sessions/evaluation/EvaluationConfusion'
import EvaluationFeedbacks from '../../../components/sessions/evaluation/EvaluationFeedbacks'

const INSTANCE_STATUS_ICON: Record<string, IconDefinition> = {
  EXECUTED: faCheck,
  ACTIVE: faSync,
}

function Collapsed({
  selectedInstance,
  currentInstance,
}: {
  selectedInstance: string
  currentInstance: Partial<InstanceResult>
}) {
  const [questionElem, setQuestionElem] = useState<HTMLDivElement | null>(null)

  const [questionCollapsed, setQuestionCollapsed] = useState<boolean>(true)
  const [showExtensibleButton, setShowExtensibleButton] =
    useState<boolean>(false)

  useEffect(() => {
    if (!questionElem) return

    // if the element height is larger than what is shown or the question was opened, show the extension button
    if (
      questionElem?.scrollHeight > questionElem?.clientHeight ||
      !questionCollapsed
    ) {
      setShowExtensibleButton(true)
    } else {
      setShowExtensibleButton(false)
    }

    return () => setQuestionElem(null)
  }, [questionCollapsed, questionElem, selectedInstance])

  return (
    <div className={`border-b-[0.1rem] border-solid border-uzh-grey-80`}>
      <div
        ref={(ref) => setQuestionElem(ref)}
        className={twMerge(
          questionCollapsed ? 'md:max-h-[7rem]' : 'md:max-h-content',
          !showExtensibleButton && 'border-solid border-b-only border-primary',
          showExtensibleButton &&
            questionCollapsed &&
            'md:bg-clip-text md:bg-gradient-to-b md:from-black md:via-black md:to-white md:text-transparent',
          'w-full md:overflow-y-hidden md:self-start flex-[0_0_auto] p-4 text-left'
        )}
      >
        <Prose
          className={{
            root: 'flex-initial max-w-full leading-8 prose-lg prose-p:m-0',
          }}
        >
          <Markdown
            className="flex flex-row content-between hover:text-black"
            content={currentInstance.questionData?.content}
          />
        </Prose>
        {/* // TODO: <div>ATTACHMENTS</div> */}
      </div>
      {showExtensibleButton && (
        <Button
          className={{
            root: twMerge(
              questionCollapsed && 'bg-gradient-to-b from-white to-slate-100',
              'hidden w-full h-4 text-xs text-center rounded-none border-0 shadow-none md:block',
              ' print:hidden hover:bg-uzh-blue-20 hover:bg-none'
            ),
          }}
          onClick={() => setQuestionCollapsed(!questionCollapsed)}
        >
          <FontAwesomeIcon
            icon={questionCollapsed ? faChevronDown : faChevronUp}
            className={twMerge('h-6 -mt-1.5', questionCollapsed && '-mt-2')}
          />
        </Button>
      )}
    </div>
  )
}

function Evaluation() {
  const router = useRouter()

  const [selectedBlock, setSelectedBlock] = useState<number>(0)
  const [leaderboard, setLeaderboard] = useState<boolean>(false)
  const [feedbacks, setFeedbacks] = useState<boolean>(false)
  const [confusion, setConfusion] = useState<boolean>(false)
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [selectedInstanceIndex, setSelectedInstanceIndex] = useState<number>(0)
  const [showSolution, setShowSolution] = useState<boolean>(false)
  const [chartType, setChartType] = useState<string>('')
  const [statisticStates, setStatisticStates] = useState<{
    [key: string]: boolean
  }>({
    mean: false,
    median: false,
    q1: false,
    q3: false,
    sd: false,
  })
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

  // the tabs array will only include the tabs that should be rendered (at most 2 * width + 1 tabs) to prevent overflows
  const width = 1
  const tabs = useMemo(() => {
    const tabs = blocks.map((block) => {
      return {
        label: 'Block ' + String(block.blockIx + 1),
        value: block.blockIx,
      }
    })

    // if fewer tabs than the maximum amount are available, return all tabs
    if (tabs.length <= 2 * width + 1) {
      return tabs
    }
    // return width tabs on both sides of the selected tab and the selected tab itself
    else if (
      selectedBlock >= width &&
      selectedBlock <= tabs.length - width - 1
    ) {
      return tabs.filter(
        (tab) =>
          tab.value <= selectedBlock + width &&
          tab.value >= selectedBlock - width
      )
    }
    // if the selected tab is too close to the end for width on both sides, return the last 2 * width + 1 tabs
    else if (selectedBlock >= blocks.length - 2) {
      return tabs.filter((tab) => tab.value >= blocks.length - 2 * width - 1)
    }

    // if the selected tab is too close to the beginning for width on both sides, return the first 2 * width + 1 tabs
    return tabs.slice(0, 2 * width + 1)
  }, [blocks, selectedBlock])

  const selectData = useMemo(() => {
    if (!blocks || !blocks[selectedBlock]) return []
    return blocks[selectedBlock].tabData?.map((question) => {
      return {
        label:
          question?.name.length > 120
            ? `${question?.name.substr(0, 120)}...`
            : question?.name,
        shortLabel:
          question?.name.length > 20
            ? `${question?.name.substr(0, 20)}...`
            : undefined,
        value: question?.id || '',
      }
    })
  }, [blocks, selectedBlock])

  useEffect(() => {
    if (!instanceResults || instanceResults.length === 0) return

    if (selectedInstance === '' && currentInstance.id === '') {
      setSelectedInstance(instanceResults[0].id)
      setCurrentInstance(instanceResults[0])
    }

    const currentInstanceIndex = instanceResults.findIndex(
      (instance) => instance.id === selectedInstance
    )
    setSelectedInstanceIndex(currentInstanceIndex)

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

  return (
    <RadixTab.Root
      className="flex flex-col h-full overflow-y-none"
      defaultValue="0"
    >
      <RadixTab.List className="flex flex-row flex-none px-3 bg-white border-b-2 border-solid justify-betweenb h-11 print:hidden">
        {blocks && blocks[selectedBlock] && (
          <div className="flex flex-row items-center gap-2">
            <RadixTab.Trigger
              value={String(
                instanceResults[selectedInstanceIndex - 1]?.blockIx
              )}
              onClick={() => {
                setSelectedInstance(
                  instanceResults[selectedInstanceIndex - 1].id
                )
                setSelectedBlock(
                  instanceResults[selectedInstanceIndex - 1].blockIx
                )
              }}
              disabled={selectedInstanceIndex === 0}
              className={twMerge(
                selectedInstanceIndex === 0 &&
                  'text-uzh-grey-80 cursor-not-allowed'
              )}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </RadixTab.Trigger>
            <RadixTab.Trigger
              value={String(
                instanceResults[selectedInstanceIndex + 1]?.blockIx
              )}
              onClick={() => {
                setSelectedInstance(
                  instanceResults[selectedInstanceIndex + 1].id
                )
                setSelectedBlock(
                  instanceResults[selectedInstanceIndex + 1].blockIx
                )
              }}
              disabled={selectedInstanceIndex === instanceResults.length - 1}
              className={twMerge(
                selectedInstanceIndex === instanceResults.length - 1 &&
                  'text-uzh-grey-80 cursor-not-allowed'
              )}
            >
              <FontAwesomeIcon icon={faArrowRight} />
            </RadixTab.Trigger>

            <div className="ml-2 font-bold">Frage:</div>

            <Select
              items={selectData || []}
              onChange={(newValue) => {
                if (newValue !== '') {
                  setSelectedInstance(newValue)
                }
              }}
              className={{
                root: 'h-[2.65rem] z-20',
                trigger:
                  'shadow-none rounded-none m-0 border-none hover:bg-uzh-blue-20 h-full',
              }}
              value={
                selectedInstance === ''
                  ? blocks[selectedBlock].tabData[0].id
                  : selectedInstance
              }
            />
          </div>
        )}
        <div className="flex flex-row ml-auto">
          <RadixTab.Trigger
            value={String(selectedBlock - 1)}
            onClick={() => {
              setSelectedInstance(blocks[selectedBlock - 1].tabData[0].id)
              setLeaderboard(false)
              setFeedbacks(false)
              setConfusion(false)
              selectedBlock === 0 ? null : setSelectedBlock(selectedBlock - 1)
            }}
            disabled={
              blocks.length <= 2 * width + 1 || selectedBlock - width <= 0
            }
          >
            <div
              className={twMerge(
                'flex flex-row items-center h-full px-2 hover:bg-uzh-blue-20',
                (blocks.length <= 2 * width + 1 ||
                  selectedBlock - width <= 0) &&
                  'text-uzh-grey-80 hover:bg-white cursor-not-allowed'
              )}
            >
              <FontAwesomeIcon icon={faChevronLeft} size="lg" />
            </div>
          </RadixTab.Trigger>

          {tabs.map((tab) => (
            <RadixTab.Trigger
              key={tab.value}
              value={String(tab.value)}
              onClick={() => {
                setSelectedBlock(tab.value)
                setLeaderboard(false)
                setFeedbacks(false)
                setConfusion(false)
                setSelectedInstance(blocks[tab.value].tabData[0].id)
              }}
              className={twMerge(
                'px-3 py-2 border-b-2 border-transparent hover:bg-uzh-blue-20 w-[7rem] text-center',
                !leaderboard &&
                  !feedbacks &&
                  !confusion &&
                  tab.value === selectedBlock &&
                  'border-solid border-uzh-blue-80'
              )}
            >
              <div className="flex flex-row items-center justify-center w-full gap-2">
                <FontAwesomeIcon
                  size="xs"
                  icon={
                    INSTANCE_STATUS_ICON[blocks[tab.value].tabData[0].status]
                  }
                />
                <div>{tab.label}</div>
              </div>
            </RadixTab.Trigger>
          ))}

          <RadixTab.Trigger
            value={String(selectedBlock + 1)}
            onClick={() => {
              setSelectedInstance(blocks[selectedBlock + 1].tabData[0].id)
              setLeaderboard(false)
              setFeedbacks(false)
              setConfusion(false)
              selectedBlock === blocks.length - 1
                ? null
                : setSelectedBlock(selectedBlock + 1)
            }}
            disabled={
              blocks.length <= 2 * width + 1 ||
              selectedBlock + width >= blocks.length - 1
            }
          >
            <div
              className={twMerge(
                'flex flex-row items-center h-full px-2 hover:bg-uzh-blue-20',
                (blocks.length <= 2 * width + 1 ||
                  selectedBlock + width >= blocks.length - 1) &&
                  'text-uzh-grey-80 hover:bg-white cursor-not-allowed'
              )}
            >
              <FontAwesomeIcon icon={faChevronRight} size="lg" />
            </div>
          </RadixTab.Trigger>
          {data.sessionEvaluation?.isGamificationEnabled && (
            <RadixTab.Trigger
              value="leaderboard"
              className={twMerge(
                'px-3 py-2 border-b-2 border-transparent hover:bg-uzh-blue-20',
                leaderboard && 'border-solid border-uzh-blue-80'
              )}
              onClick={() => {
                setLeaderboard(true)
                setFeedbacks(false)
                setConfusion(false)
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
                  feedbacks && 'border-solid border-uzh-blue-80'
                )}
                onClick={() => {
                  setFeedbacks(true)
                  setLeaderboard(false)
                  setConfusion(false)
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
                  confusion && 'border-solid border-uzh-blue-80'
                )}
                onClick={() => {
                  setConfusion(true)
                  setLeaderboard(false)
                  setFeedbacks(false)
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
              <Collapsed
                currentInstance={currentInstance}
                selectedInstance={selectedInstance}
              />

              <div className="flex flex-col flex-1 md:flex-row">
                <div className="z-10 flex-1 order-2 mx-4 md:order-1">
                  <Chart
                    chartType={chartType}
                    data={currentInstance}
                    showSolution={showSolution}
                    statisticsShowSolution={{
                      mean: statisticStates.mean,
                      median: statisticStates.median,
                      q1: statisticStates.q1,
                      q3: statisticStates.q3,
                      sd: statisticStates.sd,
                    }}
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

                              <div className="w-[calc(100%-3rem)]">
                                <Ellipsis
                                  maxLength={60}
                                  className={{ tooltip: 'z-20 float-right' }}
                                >
                                  {choice.value}
                                </Ellipsis>
                              </div>
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
                          .sort(
                            (a, b) =>
                              STATISTICS_ORDER.indexOf(a[0]) -
                              STATISTICS_ORDER.indexOf(b[0])
                          )
                          .map((statistic) => {
                            const statisticName = statistic[0]
                            return (
                              <Statistic
                                key={statisticName}
                                statisticName={statisticName}
                                value={statistic[1]}
                                hasCheckbox={
                                  !(
                                    statisticName === 'min' ||
                                    statisticName === 'max'
                                  )
                                }
                                chartType={chartType}
                                checked={statisticStates[statisticName]}
                                onCheck={() => {
                                  setStatisticStates({
                                    ...statisticStates,
                                    [statisticName]:
                                      !statisticStates[statisticName],
                                  })
                                }}
                              />
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
                  <Leaderboard
                    leaderboard={data.sessionLeaderboard}
                    className={{ podiumSingle: 'text-lg', listItem: 'text-lg' }}
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
                  className={{ message: 'text-lg' }}
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
                  className={{ message: 'text-lg' }}
                  notificationType="error"
                  message="Diese Session enthält bisher keine Confusion Feedbacks."
                />
              )}
            </div>
          </div>
        </RadixTab.Content>
      </div>

      <Footer className="relative flex-none h-18">
        {currentInstance && !feedbacks && !confusion && !leaderboard && (
          <div className="flex flex-row justify-between p-4 pr-8 m-0">
            <div className="text-xl">
              Total Teilnehmende: {currentInstance.participants}
            </div>
            <Switch
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
