import { useQuery } from '@apollo/client'
import Chart from '@components/evaluation/Chart'
import {
  faCheck,
  faChevronDown,
  faChevronUp,
  faSync,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetSessionEvaluationDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import * as SelectPrimitive from '@radix-ui/react-select'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { Button, Prose } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { groupBy } from 'ramda'
import { useMemo, useState } from 'react'
import { CHART_COLORS } from 'shared-components/src/constants'
import { twMerge } from 'tailwind-merge'

const Select = ({ items, onChange }) => {
  return (
    <SelectPrimitive.Root
      defaultValue={String(items[0].instanceIx)}
      onValueChange={onChange}
    >
      <SelectPrimitive.Trigger asChild aria-label="Food">
        <Button className="text-sm">
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon className="ml-2">
            <FontAwesomeIcon icon={faChevronDown} />
          </SelectPrimitive.Icon>
        </Button>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Content>
        <SelectPrimitive.ScrollUpButton className="flex items-center justify-center text-gray-700 dark:text-gray-300">
          <FontAwesomeIcon icon={faChevronUp} />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-2 bg-white rounded-lg shadow-lg dark:bg-gray-800 z-[9999]">
          <SelectPrimitive.Group>
            {items.map((item, ix) => (
              <SelectPrimitive.Item
                key={item.instanceIx}
                value={String(item.instanceIx)}
                className={twMerge(
                  'relative flex items-center px-8 py-2 rounded-md text-gray-700 dark:text-gray-300 font-medium focus:bg-gray-100 dark:focus:bg-gray-900',
                  'radix-disabled:opacity-50',
                  'focus:outline-none select-none'
                )}
              >
                <SelectPrimitive.ItemText>
                  {item.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute inline-flex items-center left-2">
                  <FontAwesomeIcon icon={faCheck} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Group>
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex items-center justify-center text-gray-700 dark:text-gray-300">
          <FontAwesomeIcon icon={faChevronDown} />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Root>
  )
}
interface Tab {
  status: 'EXECUTED' | 'ACTIVE'
  title: string
  value: string
}

const INSTANCE_STATUS_ICON = {
  EXECUTED: faCheck,
  ACTIVE: faSync,
}

function Evaluation() {
  const router = useRouter()

  // TODO: replace with corresponding database field and query
  const [showSolution, setShowSolution] = useState(true)
  const [activeBlock, setActiveBlock] = useState(0)
  const [activeInstance, setActiveInstance] = useState(0)

  console.log(activeBlock, activeInstance)

  const { data, loading, error } = useQuery(GetSessionEvaluationDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 5000,
    skip: !router.query.id,
  })

  const { groupedTabs } = useMemo(() => {
    if (!data) return { tabs: [] }

    const tabs = data.sessionEvaluation?.instanceResults?.map(
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

    if (!tabs) return { tabs: [] }

    const groupedTabs = Object.entries(
      groupBy((tab) => tab.blockIx.toString(), tabs)
    )

    return { tabs, groupedTabs }
  }, [data])

  const questions = useMemo(() => {
    if (!data) return []

    return data.sessionEvaluation?.instanceResults?.map((instance) => {
      const baseData = {
        blockIx: instance.blockIx,
        instanceIx: instance.instanceIx,
        content: instance.questionData.content,
        type: instance.questionData.type,
      }

      const answers = []

      if (
        instance.questionData.type === 'SC' ||
        instance.questionData.type === 'MC' ||
        instance.questionData.type === 'KPRIM'
      ) {
        // answerArray should include both all answer possibilities as well as a correct / false attribute for them
        instance.questionData.options.choices.map((choice: any) => {
          answers.push({ value: choice.value, correct: choice.correct })
        })
      } else if (instance.questionData.type === 'NUMERICAL') {
        // answerArray should include the correct answer ranges with correct attribute and the restrictions with an undefined correct attribute
        answers.push({
          value: instance.questionData.options.restrictions,
          correct: undefined,
        })
        instance.questionData.options.solutionRanges?.forEach(
          (range: { min: number; max: number }) => {
            answers.push({
              value: range,
              correct: true,
            })
          }
        )
      } else if (instance.questionData.type === 'FREE_TEXT') {
        // answerArray should include the correct keywords together with a correct: true attribute
        instance.questionData.options.solutions.forEach((solution: string) => {
          answers.push({
            value: solution,
            correct: true,
          })
        })
      }

      const results = Object.values(instance.results).map((answer) => ({
        value: answer.value,
        votes: answer.count,
      }))

      return {
        ...baseData,
        answers,
        results,
        participants: instance.participants,
      }
    })
  }, [data])

  if (error) return <div>An error occurred, please try again later.</div>
  if (loading || !data) return <div>Loading...</div>

  const currentQuestion = questions?.find(
    (question) =>
      question.blockIx == activeBlock && question.instanceIx == activeInstance
  )

  return (
    <TabsPrimitive.Root
      value={`tab-${activeBlock}`}
      className="flex flex-col h-full p-1"
    >
      <TabsPrimitive.List
        className={twMerge('flex-initial flex flex-col md:flex-row')}
      >
        {groupedTabs?.map(([blockIx, items], groupIx) => (
          <TabsPrimitive.Trigger
            key={`tab-trigger-${blockIx}`}
            value={'tab' + blockIx}
            className={twMerge(
              'px-2 py-1 border-r first:border-l border-b-2 border-b-uzh-grey-100 rdx-state-active:border-b-uzh-blue-100 hover:border-b-uzh-blue-60 hover:text-uzh-blue-100 text-slate-700 rdx-state-active:text-slate-900'
            )}
            onClick={() => {
              setActiveBlock(Number(blockIx))
              setActiveInstance(0)
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
            <Select
              items={items}
              onChange={(newIx) => {
                setActiveBlock(Number(blockIx))
                setActiveInstance(Number(newIx))
              }}
            />
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

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
                questionType={currentQuestion.type}
                data={currentQuestion.results}
                showSolution={showSolution}
                totalResponses={currentQuestion.participants}
              />
            </div>
            <div className="flex-initial order-1 w-64 p-4 border-l md:order-2">
              <div className="flex flex-col gap-2">
                {(currentQuestion.type === 'SC' ||
                  currentQuestion.type === 'MC' ||
                  currentQuestion.type === 'KPRIM') &&
                  currentQuestion.answers.map(
                    (
                      answer: {
                        value: String | { min: number; max: number }
                        correct?: Boolean
                      },
                      innerIndex: number
                    ) => (
                      <div
                        key={currentQuestion.results[innerIndex].value}
                        className="flex flex-row"
                      >
                        <div
                          style={{
                            backgroundColor: answer.correct
                              ? '#00de0d'
                              : CHART_COLORS[innerIndex % 12],
                          }}
                          className={twMerge(
                            'mr-2 text-center rounded-md w-7 h-7 text-white font-bold',
                            answer.correct && 'text-black'
                          )}
                        >
                          {String.fromCharCode(65 + innerIndex)}
                        </div>
                        <Markdown
                          content={answer.value}
                          className="w-[calc(100%-3rem)]"
                        />
                      </div>
                    )
                  )}

                {currentQuestion.type === 'NUMERICAL' && (
                  <div>
                    {/* <div className="mb-3">
                        {answerCollection[index].answers
                          .filter(
                            (answer: any) =>
                              typeof answer.correct === 'undefined'
                          )
                          .map((answer: any, index: number) => (
                            <div key={index}>
                              Einschränkungen: Wert zwischen {answer.value.min}{' '}
                              und {answer.value.max}
                            </div>
                          ))}
                      </div> */}
                    <div className="font-bold">Erlaubter Antwortbereich:</div>
                    {currentQuestion.answers.map(
                      (
                        answer: {
                          value: String | { min: number; max: number }
                          correct?: Boolean
                        },
                        innerIndex: number
                      ) => (
                        <div key={innerIndex}>
                          [{answer.value.min ?? '-∞'},{answer.value.max ?? '+∞'}
                          ]
                        </div>
                      )
                    )}
                  </div>
                )}

                {currentQuestion.type === 'FREE_TEXT' && (
                  <div>
                    <div className="font-bold">Schlüsselwörter Lösung:</div>
                    <ul>
                      {currentQuestion.answers.map(
                        (
                          answer: {
                            value: String | { min: number; max: number }
                            correct?: Boolean
                          },
                          innerIndex: number
                        ) => (
                          <li key={innerIndex}>{`- ${answer.value}`}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-row items-center flex-initial p-2 text-xl border-t">
            Teilnehmende: {currentQuestion.participants}
          </div>
        </div>
      )}
    </TabsPrimitive.Root>
  )
}

export default Evaluation
