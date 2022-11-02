import { useQuery } from '@apollo/client'
import {
  faCheck,
  faGamepad,
  faSync,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetSessionEvaluationDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import * as RadixTab from '@radix-ui/react-tabs'
import { Prose, Switch, Select } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { groupBy } from 'ramda'
import { useMemo, useState } from 'react'
import {
  ACTIVE_CHART_TYPES,
  CHART_COLORS,
} from 'shared-components/src/constants'
import SessionLeaderboard from 'shared-components/src/SessionLeaderboard'
import { twMerge } from 'tailwind-merge'
import Footer from '../../../components/common/Footer'
import Chart from '../../../components/evaluation/Chart'

// TODO: maybe move this util to another file / component or to this component - having util files in the components seems strange?
import { extractQuestions } from '../../../components/evaluation/utils'

const INSTANCE_STATUS_ICON: Record<string, IconDefinition> = {
  EXECUTED: faCheck,
  ACTIVE: faSync,
}

function Evaluation() {
  const router = useRouter()

  const [selectedBlock, setSelectedBlock] = useState(0)
  const [selectedInstance, setSelectedInstance] = useState('')
  const [leaderboardActive, setLeaderboardActive] = useState(false)

  const [showSolution, setShowSolution] = useState(false)
  const [activeBlock, setActiveBlock] = useState<number | string>(0)
  const [activeInstance, setActiveInstance] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(undefined)
  const [chartType, setChartType] = useState('')

  const { data, loading, error } = useQuery(GetSessionEvaluationDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 5000,
    skip: !router.query.id,
  })

  // TODO: query feedbacks and display them in the evaluation / ensure that they are delivered correctly if already implemented
  // TODO: query confusion feedbacks and display them in the evaluation

  // TODO: move to backend service and directly deliver this data to the client
  // returns an array of blocks with the blockId and question instances
  const blocks = useMemo(() => {
    const tabs = data?.sessionEvaluation?.instanceResults?.map((instance) => ({
      id: instance.id,
      blockIx: instance.blockIx,
      instanceOrder: instance.instanceIx,
      title: instance.questionData.name,
      status: instance.status,
    }))

    if (!data || !tabs) return []

    return Object.entries(groupBy((tab) => tab.blockIx.toString(), tabs)).map(
      ([key, value]) => ({
        blockId: key,
        questions: value,
      })
    )
  }, [data])

  console.log('blocks', blocks)

  const tabs = useMemo(
    () =>
      blocks.map((block) => {
        return {
          label: 'Block ' + String(parseInt(block.blockId) + 1),
          value: block.blockId,
        }
      }),
    [blocks]
  )
  console.log('tabs', tabs)

  // TODO: remove
  const { groupedTabs } = useMemo(() => {
    const tabs = data?.sessionEvaluation?.instanceResults?.map(
      (instance, index) => ({
        id: instance.id,
        blockIx: instance.blockIx,
        instanceIx: instance.instanceIx,
        value: 'tab' + index,
        title: instance.questionData.name,
        status: instance.status,
        label: instance.questionData.name,
      })
    )

    if (!data || !tabs) return {}

    const groupedTabs = Object.entries(
      groupBy((tab) => tab.blockIx.toString(), tabs)
    )

    return { tabs, groupedTabs }
  }, [data])

  const questions = useMemo(() => {
    if (!data) return []
    return extractQuestions(data)
  }, [data])

  if (error && !data)
    return <div>An error occurred, please try again later.</div>
  if (loading || !data) return <div>Loading...</div>

  // set initial chart type after data is present
  if (chartType === '') {
    const defaultChartType =
      ACTIVE_CHART_TYPES[
        data.sessionEvaluation.instanceResults[0].questionData.type
      ][0].value
    setChartType(defaultChartType)
  }

  // set initial question when data is present
  if (currentQuestion === undefined) {
    const currQuestion = questions?.find(
      (question) => question.blockIx === 0 && question.instanceIx === 0
    )
    setCurrentQuestion(currQuestion)
  }

  const onQuestionChange = (newIndex: string, blockIndex: string) => {
    setActiveBlock(Number(blockIndex))
    setActiveInstance(Number(newIndex))
    const currQuestion = questions?.find(
      (question) =>
        question.blockIx === Number(blockIndex) &&
        question.instanceIx === Number(newIndex)
    )
    setCurrentQuestion(currQuestion)

    // Make sure to only display chart type that is available for current question type
    const possibleChartTypes = ACTIVE_CHART_TYPES[currQuestion.type].map(
      (type) => type.value
    )
    if (!possibleChartTypes.includes(chartType)) {
      setChartType(ACTIVE_CHART_TYPES[currQuestion.type][0].value)
    }
  }

  const onBlockChange = (blockIndex: string) => {
    setActiveBlock(Number(blockIndex))
    setActiveInstance(0) // This causes weird behavior: when clicking on the select of another tab than the currently active one,
    // this function is called a new tab + new question is selected (hence the displayed chart changes)
    // before a new question is selected via the select
    // but not having it causes weir behavior as well

    // If we reset the instance, we also need to change the current question
    const currQuestion = questions?.find(
      (question) =>
        question.blockIx === Number(blockIndex) && question.instanceIx === 0
    )
    // Make sure to only display chart type that is available for current question type
    const possibleChartTypes = ACTIVE_CHART_TYPES[currQuestion.type].map(
      (type) => type.value
    )
    if (!possibleChartTypes.includes(chartType)) {
      setChartType(ACTIVE_CHART_TYPES[currQuestion.type][0].value)
    }
  }

  console.log('current Question', currentQuestion)

  // TODO: think about mobile layout (maybe at least tablet support)
  return (
    <>
      <RadixTab.Root>
        <RadixTab.List className="flex flex-row justify-between px-3 border-b-2 border-solid">
          {blocks[selectedBlock] && (
            <div className="flex flex-row items-center gap-3 my-auto">
              <div className="font-bold">Question:</div>

              <Select
                items={blocks[selectedBlock].questions
                  .sort((a, b) => a.instanceOrder - b.instanceOrder)
                  .map((question) => {
                    return { label: question.title, value: question.id }
                  })}
                onChange={(newValue) => setSelectedInstance(newValue)}
                className={{
                  trigger: 'shadow-sm border-uzh-blue-80',
                }}
                value={
                  selectedInstance === ''
                    ? blocks[selectedBlock].questions[0].id
                    : selectedInstance
                }
              />
            </div>
          )}
          <div className="ml-auto">
            {tabs.map((tab, idx) => (
              <RadixTab.Trigger
                key={tab.value}
                value={tab.value}
                onClick={() => {
                  setSelectedBlock(idx)
                  setLeaderboardActive(false)
                  setSelectedInstance(blocks[idx].questions[0].id)
                }}
                className={twMerge(
                  'px-3 py-2 hover:bg-uzh-blue-20',
                  idx === selectedBlock
                    ? 'border-b-2 border-solid border-uzh-blue-80'
                    : 'border-b-2 border-transparent'
                )}
              >
                <div className="flex flex-row items-center gap-2">
                  <FontAwesomeIcon
                    size="xs"
                    icon={INSTANCE_STATUS_ICON[blocks[idx].questions[0].status]}
                  />
                  <div>{tab.label}</div>
                </div>
              </RadixTab.Trigger>
            ))}
            <RadixTab.Trigger
              value="leaderboard"
              className={twMerge(
                'px-3 py-2 hover:bg-uzh-blue-20',
                leaderboardActive
                  ? 'border-b-2 border-solid border-uzh-blue-80'
                  : 'border-b-2 border-transparent'
              )}
              onClick={() => {
                setSelectedBlock(-1)
                setLeaderboardActive(true)
              }}
            >
              <div className="flex flex-row items-center gap-2">
                <div>
                  <FontAwesomeIcon icon={faGamepad} />
                </div>
                <div>Leaderboard</div>
              </div>
            </RadixTab.Trigger>
          </div>
        </RadixTab.List>
      </RadixTab.Root>
      <RadixTab.Root
        value={`tab-${activeBlock}`}
        className="flex flex-col h-full"
      >
        <RadixTab.List className="flex flex-row m-2">
          {groupedTabs?.map(([blockIx, items], groupIx) => (
            <RadixTab.Trigger
              key={`tab-trigger-${blockIx}`}
              value={'tab' + blockIx}
              className={twMerge(
                'px-2 py-1 border-r first:border-l border-b-2 border-b-uzh-grey-100 rdx-state-active:border-b-uzh-blue-100 hover:border-b-uzh-blue-60 hover:text-uzh-blue-100 text-slate-700 rdx-state-active:text-slate-900'
              )}
              onClick={() => {
                onBlockChange(blockIx)
              }}
            >
              <div className="flex flex-row items-center gap-1 text-sm text-left">
                <div>
                  <FontAwesomeIcon
                    size="xs"
                    icon={INSTANCE_STATUS_ICON[items[0].status]}
                  />
                </div>
                <div>Block {Number(blockIx) + 1}</div>
              </div>
              {/* <Select
                items={items.map((item) => ({
                  value: String(item.instanceIx),
                  label: item.label,
                }))}
                onChange={(newIx) => {
                  onQuestionChange(newIx, blockIx)
                }}
              /> */}
            </RadixTab.Trigger>
          ))}

          <RadixTab.Trigger
            key="tab-trigger-lb"
            value="tab-lb"
            className={twMerge(
              'px-2 py-1 border-r first:border-l border-b-2 border-b-uzh-grey-100 rdx-state-active:border-b-uzh-blue-100 hover:border-b-uzh-blue-60 hover:text-uzh-blue-100 text-slate-700 rdx-state-active:text-slate-900'
            )}
            onClick={() => {
              setActiveBlock('lb')
            }}
          >
            <div className="flex flex-row items-center gap-1 text-sm text-left">
              <div>
                <FontAwesomeIcon icon={faGamepad} />
              </div>
              <div>Leaderboard</div>
            </div>
          </RadixTab.Trigger>
        </RadixTab.List>

        {currentQuestion && (
          <div>
            <Prose className="flex-initial prose-xl border-b prose-p:m-0 max-w-none">
              <Markdown
                className="flex flex-row content-between p-2"
                content={currentQuestion.content}
              />
            </Prose>

            <div className="flex flex-col flex-1 md:flex-row">
              <div className="z-10 flex-1 order-2 md:order-1">
                <Chart
                  chartType={chartType}
                  data={currentQuestion}
                  showSolution={showSolution}
                />
              </div>
              <div className="flex-initial order-1 w-64 p-4 border-l md:order-2">
                <div className="flex flex-col gap-2">
                  {(currentQuestion.type === 'SC' ||
                    currentQuestion.type === 'MC' ||
                    currentQuestion.type === 'KPRIM') &&
                    currentQuestion.answers.map((answer, innerIndex) => (
                      <div
                        key={currentQuestion.answers[innerIndex].value}
                        className="flex flex-row"
                      >
                        <div
                          // TODO: use single color for answer options to highlight correct one? or some other approach to distinguish better
                          style={{
                            backgroundColor:
                              answer.correct && showSolution
                                ? '#00de0d'
                                : CHART_COLORS[innerIndex % 12],
                          }}
                          className={twMerge(
                            'mr-2 text-center rounded-md w-7 h-7 text-white font-bold',
                            answer.correct && showSolution && 'text-black'
                          )}
                        >
                          {String.fromCharCode(65 + innerIndex)}
                        </div>
                        <Markdown
                          content={answer.value}
                          className="w-[calc(100%-3rem)]"
                        />
                      </div>
                    ))}

                  {currentQuestion.type === 'NUMERICAL' && (
                    <div>
                      <div className="font-bold">Erlaubter Antwortbereich:</div>
                      <div>
                        [{currentQuestion.restrictions!.min ?? '-∞'},
                        {currentQuestion.restrictions!.max ?? '+∞'}]
                      </div>
                      {showSolution &&
                        currentQuestion.solutions!.solutionRanges && (
                          <div>
                            <div className="mt-2 font-bold">
                              Korrekte Lösungsbereiche:
                            </div>
                            {currentQuestion.solutions!.solutionRanges.map(
                              (range, innerIndex) => (
                                <div key={innerIndex}>
                                  [{range.min ?? '-∞'},{range.max ?? '+∞'}]
                                </div>
                              )
                            )}
                          </div>
                        )}
                    </div>
                  )}
                  {currentQuestion.type === 'FREE_TEXT' &&
                    currentQuestion.solutions!.freeTextSolutions &&
                    showSolution && (
                      <div>
                        <div className="font-bold">Schlüsselwörter Lösung:</div>
                        <ul>
                          {currentQuestion.solutions!.freeTextSolutions.map(
                            (keyword, innerIndex) => (
                              <li key={innerIndex}>{`- ${keyword}`}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  {/* {currentQuestion && (
                    <Select
                      // TODO: Find out why default is sometimes empty
                      defaultValue={chartType}
                      items={ACTIVE_CHART_TYPES[currentQuestion.type]}
                      onChange={(newValue) => {
                        console.log('newValue', newValue)
                        setChartType(newValue)
                      }}
                    ></Select>
                  )} */}
                </div>
              </div>
            </div>
            <Footer>
              <div className="flex flex-row justify-between px-8 py-4 m-0">
                <div className="text-xl">
                  Total Teilnehmende: {currentQuestion.participants}
                </div>
                <Switch
                  id="showSolution"
                  checked={showSolution}
                  label="Lösung anzeigen"
                  onCheckedChange={(newValue) => setShowSolution(newValue)}
                ></Switch>
              </div>
            </Footer>
          </div>
        )}
        {/* TODO: Find way to empty currentQuestion when this tab is selected */}
        <RadixTab.Content value="tab-lb">
          <div className="p-4 border-t">
            <div className="max-w-5xl mx-auto text-xl">
              <SessionLeaderboard leaderboard={data.sessionLeaderboard} />
            </div>
          </div>
        </RadixTab.Content>
      </RadixTab.Root>
    </>
  )
}

export default Evaluation
