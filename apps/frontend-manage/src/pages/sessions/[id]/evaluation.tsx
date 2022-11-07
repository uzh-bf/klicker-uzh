import { useQuery } from '@apollo/client'
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
  GetSessionEvaluationDocument,
  GetSessionEvaluationQuery,
} from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import * as RadixTab from '@radix-ui/react-tabs'
import { Prose, Select, Switch } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import {
  ACTIVE_CHART_TYPES,
  CHART_COLORS,
} from 'shared-components/src/constants'
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
  const [showSolution, setShowSolution] = useState(false)
  const [chartType, setChartType] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState<
    | {
        type: 'SC' | 'MC' | 'KPRIM'
        content: string
        blockIx: number
        instanceIx: number
        participants: number
        answers: { value: string; correct: boolean; count: number }[]
      } // choices question types
    | {
        type: 'FREE_TEXT'
        content: string
        blockIx: number
        instanceIx: number
        participants: number
        answers: { value: string; count: number }[]
        solutions: string[]
      } // free text question type
    | {
        type: 'NUMERICAL'
        content: string
        blockIx: number
        instanceIx: number
        participants: number
        answers: { value: string; count: number }[]
        restrictions: { min?: number; max?: number }
        solutions: { min?: number; max?: number }[]
      } // numerical text question type
  >({
    type: 'SC',
    content: '',
    blockIx: 0,
    instanceIx: 0,
    participants: 0,
    answers: [],
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

  // TODO: query feedbacks and display them in the evaluation / ensure that they are delivered correctly if already implemented
  // TODO: query confusion feedbacks and display them in the evaluation

  const questions = useMemo(() => {
    if (!instanceResults) return []

    // TODO: possibly replace / rewrite if requested
    return extractQuestions(instanceResults)
  }, [instanceResults])

  const selectData = useMemo(() => {
    if (!blocks || !blocks[selectedBlock]) return []
    return blocks[selectedBlock].tabData?.map((question) => {
      return { label: question?.name || '', value: question?.id || '' }
    })
  }, [blocks, selectedBlock])

  useEffect(() => {
    if (questions.length === 0) return

    if (chartType === '') {
      setChartType(ACTIVE_CHART_TYPES[questions[0].type][0].value)
    }
    const currQuestion = questions?.find((question) =>
      selectedInstance !== ''
        ? question.id === selectedInstance
        : question.blockIx === selectedBlock
    )
    setCurrentQuestion(currQuestion)
  }, [questions, chartType, selectedBlock, selectedInstance])

  if (error && !data)
    return <div>An error occurred, please try again later.</div>
  if (loading || !data) return <div>Loading...</div>

  // TODO: think about mobile layout (maybe at least tablet support)
  return (
    <RadixTab.Root className="h-full">
      <RadixTab.List className="flex flex-row justify-between px-3 border-b-2 border-solid h-11">
        {blocks && blocks[selectedBlock] && (
          <div className="flex flex-row items-center gap-3">
            <div className="font-bold">Question:</div>

            <Select
              items={selectData || []}
              onChange={(newValue) => setSelectedInstance(newValue)}
              className={{
                root: 'h-full z-20',
                trigger:
                  'shadow-sm rounded-none m-0 border-none bg-uzh-blue-20 hover:bg-uzh-blue-40',
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
          <RadixTab.Trigger
            value="leaderboard"
            className={twMerge(
              'px-3 py-2 border-b-2 border-transparent hover:bg-uzh-blue-20',
              selectedBlock === tabs.length && 'border-solid border-uzh-blue-80'
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
        </div>
      </RadixTab.List>
      {currentQuestion && (
        <RadixTab.Content value={String(currentQuestion.blockIx)}>
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
                          // TODO: possibly use single color for answer options to highlight correct one? or some other approach to distinguish better
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
                      {showSolution && currentQuestion.solutions && (
                        <div>
                          <div className="mt-2 font-bold">
                            Korrekte Lösungsbereiche:
                          </div>
                          {currentQuestion.solutions.map(
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
                    currentQuestion.solutions &&
                    showSolution && (
                      <div>
                        <div className="font-bold">Schlüsselwörter Lösung:</div>
                        <ul>
                          {currentQuestion.solutions.map(
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
            LEADERBOARD PLACEHOLDER
            {/* // TODO: implement */}
            {/* <SessionLeaderboard leaderboard={data.sessionLeaderboard} /> */}
          </div>
        </div>
      </RadixTab.Content>
      <RadixTab.Content value="feedbacks">
        <div className="p-4 border-t">
          <div className="max-w-5xl mx-auto text-xl">
            FEEDBACKS PLACEHOLDER
            {/* // TODO: implement */}
          </div>
        </div>
      </RadixTab.Content>
      <RadixTab.Content value="confusion">
        <div className="p-4 border-t">
          <div className="max-w-5xl mx-auto text-xl">
            CONFUSION PLACEHOLDER
            {/* // TODO: implement */}
          </div>
        </div>
      </RadixTab.Content>

      <Footer className="mx-0">
        {currentQuestion && (
          <div className="flex flex-row justify-between p-4 pr-8 m-0">
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
        )}
      </Footer>
    </RadixTab.Root>
  )
}

export default Evaluation
