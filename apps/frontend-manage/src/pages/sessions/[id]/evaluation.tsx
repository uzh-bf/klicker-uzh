import { useQuery } from '@apollo/client'
import { GetSessionEvaluationDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'

interface Tab {
  title: string
  value: string
}

function Evaluation() {
  const router = useRouter()

  const { data, loading, error } = useQuery(GetSessionEvaluationDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 10000,
    skip: !router.query.id,
  })
  if (error) return <div>An error occurred, please try again later.</div>
  if (loading || !data) return <div>Loading...</div>

  console.log(data?.sessionEvaluation)

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
      }
      answerArray.push({
        answers: innerArray,
        type: instance.questionData.type,
      })
    })
    return answerArray
  }

  const tabs = getTabs(data)
  const questions = getQuestions(data)
  const answerCollection = getAnswers(data)
  console.log(answerCollection)

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
            <div>
              <span className="flex">Chart goes here</span>
              <span className="flex justify-end">
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
                        <div key={innerIndex} className="flex flex-row">
                          <div
                            className={twMerge(
                              'flex flex-col justify-center mr-2 text-center rounded-md w-7 h-7 bg-uzh-blue-80 text-white font-bold',
                              answer.correct && 'bg-green-500 text-black'
                            )}
                          >
                            {innerIndex}
                          </div>
                          <Markdown content={answer.value} />
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
                </div>
              </span>
            </div>
          </TabsPrimitive.Content>
        ))}
      </TabsPrimitive.Root>
    </div>
  )
}

export default Evaluation

// Example object
// {
//   "sessionEvaluation": {
//     "__typename": "SessionEvaluation",
//     "id": "f0b9ac89-6f25-43d8-b1b4-0bfcfcfad35f-eval",
//     "instanceResults": [
//       {
//         "__typename": "InstanceResults",
//         "id": "28-eval",
//         "blockIx": 0,
//         "instanceIx": 0,
//         "status": "EXECUTED",
//         "questionData": {
//           "__typename": "FreeTextQuestionData",
//           "id": 6,
//           "name": "Freitext Testfrage",
//           "type": "FREE_TEXT",
//           "content": "Was ist richtig?",
//           "contentPlain": "Was ist richtig?",
//           "options": {
//             "__typename": "FreeTextQuestionOptions",
//             "restrictions": {
//               "__typename": "FreeTextRestrictions",
//               "maxLength": 200
//             },
//             "solutions": [
//               "Schweiz",
//               "CH"
//             ]
//           }
//         },
//         "results": {}
//       },
//       {
//         "__typename": "InstanceResults",
//         "id": "29-eval",
//         "blockIx": 0,
//         "instanceIx": 1,
//         "status": "EXECUTED",
//         "questionData": {
//           "__typename": "NumericalQuestionData",
//           "id": 5,
//           "name": "Numerische Testfrage",
//           "type": "NUMERICAL",
//           "content": "Was ist richtig?",
//           "contentPlain": "Was ist richtig?",
//           "options": {
//             "__typename": "NumericalQuestionOptions",
//             "restrictions": {
//               "__typename": "NumericalRestrictions",
//               "min": 0,
//               "max": 10
//             },
//             "solutionRanges": [
//               {
//                 "__typename": "NumericalSolutionRange",
//                 "min": 0.5,
//                 "max": 0.6
//               },
//               {
//                 "__typename": "NumericalSolutionRange",
//                 "min": 2,
//                 "max": null
//               },
//               {
//                 "__typename": "NumericalSolutionRange",
//                 "min": null,
//                 "max": 4
//               },
//               {
//                 "__typename": "NumericalSolutionRange",
//                 "min": 5,
//                 "max": null
//               },
//               {
//                 "__typename": "NumericalSolutionRange",
//                 "min": null,
//                 "max": 5
//               }
//             ]
//           }
//         },
//         "results": {}
//       },
//       {
//         "__typename": "InstanceResults",
//         "id": "30-eval",
//         "blockIx": 0,
//         "instanceIx": 2,
//         "status": "EXECUTED",
//         "questionData": {
//           "__typename": "ChoicesQuestionData",
//           "id": 9,
//           "name": "Zieldreieck",
//           "type": "SC",
//           "content": "Welche der folgenden Aussagen ist **falsch**?",
//           "contentPlain": "Welche der folgenden Aussagen ist falsch?",
//           "options": {
//             "__typename": "ChoicesQuestionOptions",
//             "choices": [
//               {
//                 "__typename": "Choice",
//                 "ix": 0,
//                 "correct": false,
//                 "feedback": "Falsch! Zwischen den Zielsetzungen des klassischen finanziellen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.",
//                 "value": "Zwischen den Zielsetzungen des klassischen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien."
//               },
//               {
//                 "__typename": "Choice",
//                 "ix": 1,
//                 "correct": true,
//                 "feedback": "Korrekt! Je höher die angestrebte Sicherheit, desto weniger Risiko wird eingegangen, was wiederum die Rentabilität senkt.",
//                 "value": "Das Ziel einer hohen Rentabilität erhöht auch die Sicherheit eines Unternehmens."
//               },
//               {
//                 "__typename": "Choice",
//                 "ix": 2,
//                 "correct": false,
//                 "feedback": "Falsch! Die Unabhängigkeit ist kein Ziel des klassischen Zieldreiecks.",
//                 "value": "Unabhängigkeit ist *kein* Ziel des klassischen Zieldreiecks."
//               },
//               {
//                 "__typename": "Choice",
//                 "ix": 3,
//                 "correct": false,
//                 "feedback": "Falsch! Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.",
//                 "value": "Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist."
//               },
//               {
//                 "__typename": "Choice",
//                 "ix": 4,
//                 "correct": false,
//                 "feedback": "Falsch! Der Shareholder Value ist kein Ziel des klassischen Zieldreiecks.",
//                 "value": "Der Shareholder Value ist *kein* Ziel des klassischen Zieldreiecks."
//               }
//             ]
//           }
//         },
//         "results": {
//           "0": {
//             "count": "0",
//             "value": "0"
//           },
//           "1": {
//             "count": "0",
//             "value": "1"
//           },
//           "2": {
//             "count": "0",
//             "value": "2"
//           },
//           "3": {
//             "count": "0",
//             "value": "3"
//           },
//           "4": {
//             "count": "0",
//             "value": "4"
//           }
//         }
//       },
//       {
//         "__typename": "InstanceResults",
//         "id": "31-eval",
//         "blockIx": 1,
//         "instanceIx": 0,
//         "status": "ACTIVE",
//         "questionData": {
//           "__typename": "ChoicesQuestionData",
//           "id": 9,
//           "name": "Zieldreieck",
//           "type": "SC",
//           "content": "Welche der folgenden Aussagen ist **falsch**?",
//           "contentPlain": "Welche der folgenden Aussagen ist falsch?",
//           "options": {
//             "__typename": "ChoicesQuestionOptions",
//             "choices": [
//               {
//                 "__typename": "Choice",
//                 "ix": 0,
//                 "correct": false,
//                 "feedback": "Falsch! Zwischen den Zielsetzungen des klassischen finanziellen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.",
//                 "value": "Zwischen den Zielsetzungen des klassischen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien."
//               },
//               {
//                 "__typename": "Choice",
//                 "ix": 1,
//                 "correct": true,
//                 "feedback": "Korrekt! Je höher die angestrebte Sicherheit, desto weniger Risiko wird eingegangen, was wiederum die Rentabilität senkt.",
//                 "value": "Das Ziel einer hohen Rentabilität erhöht auch die Sicherheit eines Unternehmens."
//               },
//               {
//                 "__typename": "Choice",
//                 "ix": 2,
//                 "correct": false,
//                 "feedback": "Falsch! Die Unabhängigkeit ist kein Ziel des klassischen Zieldreiecks.",
//                 "value": "Unabhängigkeit ist *kein* Ziel des klassischen Zieldreiecks."
//               },
//               {
//                 "__typename": "Choice",
//                 "ix": 3,
//                 "correct": false,
//                 "feedback": "Falsch! Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.",
//                 "value": "Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist."
//               },
//               {
//                 "__typename": "Choice",
//                 "ix": 4,
//                 "correct": false,
//                 "feedback": "Falsch! Der Shareholder Value ist kein Ziel des klassischen Zieldreiecks.",
//                 "value": "Der Shareholder Value ist *kein* Ziel des klassischen Zieldreiecks."
//               }
//             ]
//           }
//         },
//         "results": {
//           "choices": {
//             "0": 0,
//             "1": 0,
//             "2": 0,
//             "3": 0,
//             "4": 0
//           }
//         }
//       }
//     ]
//   }
// }
