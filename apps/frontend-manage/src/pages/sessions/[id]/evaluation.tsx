import { useQuery } from '@apollo/client'
import Chart from '@components/evaluation/Chart'
import { faCheck, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetSessionEvaluationDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { Prose } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { CHART_COLORS } from 'src/constants'
import { twMerge } from 'tailwind-merge'

interface Tab {
  status: 'EXECUTED' | 'ACTIVE'
  title: string
  value: string
}

function getTabs(data: any): Tab[] {
  if (!data) return []

  const tabArray: Tab[] = []
  data.sessionEvaluation.instanceResults.map((instance: any, index: number) => {
    tabArray.push({
      value: 'tab' + index,
      title: instance.questionData.name,
      status: instance.status,
    })
  })
  return tabArray
}

function getQuestions(data: any): String[] {
  if (!data) return []

  const questionArray: String[] = []
  data.sessionEvaluation.instanceResults.map((instance: any, index: number) => {
    questionArray.push(instance.questionData.content)
  })
  return questionArray
}

function getAnswers(data: any): {
  answers: {
    value: String | { min: number; max: number }
    correct?: Boolean
  }[]
  type: String
}[] {
  if (!data) return []

  const answerArray: {
    answers: {
      value: String | { min: number; max: number }
      correct?: Boolean
    }[]
    type: String
  }[] = []
  data.sessionEvaluation.instanceResults.map((instance: any) => {
    const innerArray: {
      value: String | { min: number; max: number }
      correct?: Boolean
    }[] = []
    if (
      instance.questionData.type === 'SC' ||
      instance.questionData.type === 'MC' ||
      instance.questionData.type === 'KPRIM'
    ) {
      // answerArray should include both all answer possibilities as well as a correct / false attribute for them
      instance.questionData.options.choices.map((choice: any) => {
        innerArray.push({ value: choice.value, correct: choice.correct })
      })
    } else if (instance.questionData.type === 'NUMERICAL') {
      // answerArray should include the correct answer ranges with correct attribute and the restrictions with an undefined correct attribute
      innerArray.push({
        value: instance.questionData.options.restrictions,
        correct: undefined,
      })
      instance.questionData.options.solutionRanges?.forEach(
        (range: { min: number; max: number }) => {
          innerArray.push({
            value: range,
            correct: true,
          })
        }
      )
    } else if (instance.questionData.type === 'FREE_TEXT') {
      // answerArray should include the correct keywords together with a correct: true attribute
      instance.questionData.options.solutions.forEach((solution: string) => {
        innerArray.push({
          value: solution,
          correct: true,
        })
      })
    }
    answerArray.push({
      answers: innerArray,
      type: instance.questionData.type,
    })
  })
  return answerArray
}

function getChartData(data: any) {
  if (!data) return []

  console.log(data)
  return data?.sessionEvaluation?.instanceResults.map((result: any) => ({
    type: result.questionData.type,
    data: Object.values(result.results).map((answer) => ({
      value: answer.value,
      votes: answer.count,
    })),
    participants: result.participants,
  }))
}

const INSTANCE_STATUS_ICON = {
  EXECUTED: faCheck,
  ACTIVE: faSync,
}

function Evaluation() {
  const router = useRouter()
  // TODO: replace with corresponding database field and query
  const [showSolution, setShowSolution] = useState(true)

  const { data, loading, error } = useQuery(GetSessionEvaluationDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 5000,
    skip: !router.query.id,
  })

  const tabs = useMemo(() => getTabs(data), [data])
  const questions = useMemo(() => getQuestions(data), [data])
  const answerCollection = useMemo(() => getAnswers(data), [data])
  const chartData = useMemo(() => getChartData(data), [data])

  if (error) return <div>An error occurred, please try again later.</div>
  if (loading || !data) return <div>Loading...</div>

  return (
    <TabsPrimitive.Root
      defaultValue="tab0"
      className="flex flex-col h-full p-1"
    >
      <TabsPrimitive.List
        className={twMerge('flex-initial flex flex-col md:flex-row')}
      >
        {tabs.map((instance, index) => (
          <TabsPrimitive.Trigger
            key={`tab-trigger-${index}`}
            value={'tab' + index}
            className={twMerge(
              'py-1 px-3 border-r first:border-l border-b-2 border-b-uzh-grey-100 rdx-state-active:border-b-uzh-blue-100 hover:border-b-uzh-blue-60 hover:text-uzh-blue-100 text-slate-700 rdx-state-active:text-slate-900 flex flex-row items-center gap-2'
            )}
          >
            <FontAwesomeIcon
              size="xs"
              icon={INSTANCE_STATUS_ICON[instance.status]}
            />
            {instance.title}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {questions.map((question, index) => (
        <TabsPrimitive.Content
          key={`tab-content-${index}`}
          value={'tab' + index}
          className={twMerge('bg-white flex flex-col rdx-state-active:flex-1')}
        >
          <Prose className="flex-initial prose-xl border-b prose-p:m-0 max-w-none">
            <Markdown
              className="flex flex-row content-between p-2"
              content={question}
            />
          </Prose>

          <div className="flex flex-col flex-1 md:flex-row">
            <div className="flex-1 order-2 md:order-1">
              <Chart
                questionType={chartData[index]?.type}
                data={chartData[index]?.data}
                showSolution={showSolution}
                totalResponses={chartData[index]?.participants}
              />
            </div>
            <div className="flex-initial order-1 w-64 p-4 border-l md:order-2">
              <div className="flex flex-col gap-2">
                {(answerCollection[index].type === 'SC' ||
                  answerCollection[index].type === 'MC' ||
                  answerCollection[index].type === 'KPRIM') &&
                  answerCollection[index].answers.map(
                    (
                      answer: {
                        value: String | { min: number; max: number }
                        correct?: Boolean
                      },
                      innerIndex: number
                    ) => (
                      <div
                        key={chartData[index].data[innerIndex].value}
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

                {answerCollection[index].type === 'NUMERICAL' && (
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
                    {answerCollection[index].answers.map(
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

                {answerCollection[index].type === 'FREE_TEXT' && (
                  <div>
                    <div className="font-bold">Schlüsselwörter Lösung:</div>
                    <ul>
                      {answerCollection[index].answers.map(
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
            Teilnehmende: {chartData[index]?.participants}
          </div>
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}

export default Evaluation
