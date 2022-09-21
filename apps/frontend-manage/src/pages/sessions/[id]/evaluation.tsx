import { useQuery } from '@apollo/client'
import { GetSessionEvaluationDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { QuestionType } from '@klicker-uzh/prisma'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Chart from '../../../components/evaluation/Chart'

interface Tab {
  title: string
  value: string
}

function Evaluation() {
  const router = useRouter()
  // TODO: replace with corresponding database field and query
  const [showSolution, setShowSolution] = useState(true)

  // TODO: replace dummy data with actual results from DB
  const dummyData: {
    questionType: QuestionType
    data: { value: string | number; correct: boolean; votes: number }[]
  }[] = [
    {
      questionType: 'NUMERICAL',
      data: [
        { value: 3, correct: true, votes: 10 },
        { value: 5, correct: true, votes: 12 },
        { value: 17, correct: false, votes: 3 },
        { value: 92, correct: true, votes: 1 },
        { value: 11, correct: false, votes: 30 },
      ],
    },
    {
      questionType: 'FREE_TEXT',
      data: [
        { value: 'Answer 1', correct: true, votes: 2 },
        { value: 'Answer 2', correct: false, votes: 6 },
        { value: 'Answer 3', correct: true, votes: 12 },
        { value: 'Answer 4', correct: false, votes: 4 },
      ],
    },
    {
      questionType: 'NUMERICAL',
      data: [
        { value: 3, correct: true, votes: 10 },
        { value: 1, correct: true, votes: 12 },
        { value: 7, correct: false, votes: 3 },
        { value: 2, correct: true, votes: 1 },
        { value: 1, correct: false, votes: 30 },
        { value: 1.5, correct: false, votes: 4 },
      ],
    },
    {
      questionType: 'SC',
      data: [
        { value: 'A', votes: 10, correct: true },
        { value: 'B', votes: 1, correct: false },
        { value: 'C', votes: 20, correct: true },
        { value: 'D', votes: 10, correct: false },
        { value: 'E', votes: 11, correct: false },
      ],
    },
    {
      questionType: 'NUMERICAL',
      data: [
        { value: 3, correct: true, votes: 10 },
        { value: 1, correct: true, votes: 12 },
        { value: 7, correct: false, votes: 3 },
        { value: 2, correct: true, votes: 1 },
        { value: 1, correct: false, votes: 30 },
        { value: 1.5, correct: false, votes: 4 },
        { value: 100, correct: false, votes: 30 },
        { value: 18, correct: false, votes: 20 },
        { value: 61, correct: false, votes: 30 },
      ],
    },
  ]

  const { data, loading, error } = useQuery(GetSessionEvaluationDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 10000,
    skip: !router.query.id,
  })
  if (error) return <div>An error occurred, please try again later.</div>
  if (loading || !data) return <div>Loading...</div>

  function getTabs(currentData: any): Tab[] {
    const tabArray: Tab[] = []
    currentData.sessionEvaluation.instanceResults.map(
      (instance: any, index: number) => {
        tabArray.push({
          value: 'tab' + index,
          title: instance.questionData.name,
        })
      }
    )
    return tabArray
  }

  function getQuestions(currentData: any): String[] {
    const questionArray: String[] = []
    currentData.sessionEvaluation.instanceResults.map(
      (instance: any, index: number) => {
        questionArray.push(instance.questionData.content)
      }
    )
    return questionArray
  }

  function getAnswers(currentData: any): {
    answers: {
      value: String | { min: number; max: number }
      correct?: Boolean
    }[]
    type: String
  }[] {
    const answerArray: {
      answers: {
        value: String | { min: number; max: number }
        correct?: Boolean
      }[]
      type: String
    }[] = []
    currentData.sessionEvaluation.instanceResults.map((instance: any) => {
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
        instance.questionData.options.solutionRanges.forEach(
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
    // TODO: implement
    // console.log(data?.sessionEvaluation?.instanceResults)
    return data?.sessionEvaluation?.instanceResults
  }

  const tabs = getTabs(data)
  const questions = getQuestions(data)
  const answerCollection = getAnswers(data)
  const chartData = dummyData // TODO: replace with getChartData(data)

  return (
    <div className="mx-4 mt-2">
      <TabsPrimitive.Root defaultValue="tab0">
        <TabsPrimitive.List
          className={twMerge('flex w-full rounded-t-lg bg-uzh-grey-20')}
        >
          {tabs.map((instance: any, index: number) => (
            <TabsPrimitive.Trigger
              key={`tab-trigger-${index}`}
              value={'tab' + index}
              className={twMerge(
                'group',
                'first:rounded-tl-lg last:rounded-tr-lg',
                'border border-slate-600 border-b first:border-r-0 last:border-l-0',
                'border-slate-600',
                'rdx-state-active:border-b-slate-600 focus-visible:rdx-state-active:border-b-transparent rdx-state-inactive:bg-white',
                'flex-1 px-3 py-2.5 rdx-state-active:border-b-0',
                'focus:z-10 focus:outline-none focus-visible:ring focus-visible:ring-opacity-75'
              )}
            >
              <span
                className={twMerge('text-sm font-medium', 'text-slate-800')}
              >
                {instance.title}
              </span>
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        {questions.map((question: any, index: number) => (
          <TabsPrimitive.Content
            key={`tab-content-${index}`}
            value={'tab' + index}
            className={twMerge('rounded-b-lg bg-white')}
          >
            <Markdown
              className="flex flex-row content-between p-2 mb-10 border-slate-800 bg-uzh-grey-20"
              content={question}
            />
            <div className="flex flex-row">
              <div className="w-2/3">
                <Chart
                  questionType={dummyData[index]?.questionType}
                  data={chartData[index]?.data}
                  showSolution={showSolution}
                />
              </div>
              <div className="flex-1">
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
                            className={twMerge(
                              'mr-2 text-center rounded-md w-7 h-7 bg-uzh-blue-80 text-white font-bold',
                              answer.correct && 'bg-green-500 text-black'
                            )}
                          >
                            <div>{chartData[index].data[innerIndex].value}</div>
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
                      <div className="mb-3">
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
                      </div>
                      <div className="font-bold">Korrekte Antwortbereiche:</div>
                      {answerCollection[index].answers.map(
                        (
                          answer: {
                            value: String | { min: number; max: number }
                            correct?: Boolean
                          },
                          innerIndex: number
                        ) => (
                          <div key={innerIndex}>
                            [{answer.value.min || '-∞'},
                            {answer.value.max || '+∞'}]
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
          </TabsPrimitive.Content>
        ))}
      </TabsPrimitive.Root>
    </div>
  )
}

export default Evaluation
