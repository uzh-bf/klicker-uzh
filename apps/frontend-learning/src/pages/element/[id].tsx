import { useMutation, useQuery } from '@apollo/client'
import {
  GetLearningElementDocument,
  ResponseToQuestionInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Progress, Prose } from '@uzh-bf/design-system'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { QuestionType } from '../../types/app'

const PLACEHOLDER_IMG =
  'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/placeholder.png'

interface Props {
  questionType: string
  options: any
  response: any
  onChangeResponse: any
  onSubmitResponse: any
  isEvaluation?: boolean
}

function OptionsDisplay({
  isEvaluation,
  response,
  onChangeResponse,
  onSubmitResponse,
  questionType,
  options,
}: Props) {
  useEffect(() => {
    if (questionType === QuestionType.SC || questionType === QuestionType.MC) {
      onChangeResponse([])
    } else if (questionType === QuestionType.FREE_TEXT) {
    } else if (questionType === QuestionType.NUMERICAL) {
    }
  }, [questionType, onChangeResponse])

  if (!response) return null

  switch (questionType) {
    case QuestionType.SC:
      return (
        <div className="flex flex-col">
          <div className="space-y-2">
            {options.choices?.map((choice: any, ix: number) => (
              <div key={choice.value} className="w-full">
                <Button
                  disabled={isEvaluation}
                  active={response.includes(ix)}
                  className={twMerge(
                    'px-4 py-2 text-sm',
                    response.includes(ix) && 'border-uzh-red-100',
                    isEvaluation && 'text-gray-700',
                    choice.correct && 'bg-green-300 border-green-600'
                  )}
                  fluid
                  onClick={() => onChangeResponse([ix])}
                >
                  {choice.value}
                </Button>
              </div>
            ))}
          </div>
          <div className="self-end mt-4">
            <Button
              disabled={!isEvaluation && response.length === 0}
              onClick={onSubmitResponse}
            >
              {isEvaluation ? 'Next Question' : 'Submit'}
            </Button>
          </div>
        </div>
      )

    case QuestionType.MC:
      return (
        <div className="flex flex-col">
          <div className="space-y-2">
            {options.choices?.map((choice: any, ix: number) => (
              <div key={choice.value} className="w-full">
                <Button
                  active={response.includes(ix)}
                  className={twMerge(
                    'px-4 py-2 text-sm',
                    response.includes(ix) && 'border-uzh-red-100',
                    isEvaluation && 'text-gray-700',
                    choice.correct && 'bg-green-300 border-green-600'
                  )}
                  fluid
                  onClick={() =>
                    onChangeResponse((prev: any) => {
                      if (prev.includes(ix)) {
                        return prev.filter((c: any) => c !== ix)
                      } else {
                        return [...prev, ix]
                      }
                    })
                  }
                >
                  {choice.value}
                </Button>
              </div>
            ))}
          </div>
          <div className="self-end mt-4">
            <Button
              disabled={!isEvaluation && response.length === 0}
              onClick={onSubmitResponse}
            >
              {isEvaluation ? 'Next Question' : 'Submit'}
            </Button>
          </div>
        </div>
      )

    case QuestionType.FREE_TEXT:
      return <div></div>

    case QuestionType.NUMERICAL:
      return <div></div>

    default:
      return <div></div>
  }
}

function EvaluationDisplay({
  questionType,
  response,
  options,
  evaluation,
}: any) {
  switch (questionType) {
    case QuestionType.SC: {
      return (
        <div className="flex flex-col">
          <div>
            {evaluation.feedbacks.map((fb) => (
              <div key={fb.feedback}>{fb.feedback}</div>
            ))}
          </div>

          {Object.entries(evaluation.choices).map(([ix, value]) => (
            <div key={value as string}>{value as string}</div>
          ))}
        </div>
      )
    }

    case QuestionType.MC:
      return (
        <div className="flex flex-col">
          <div>
            {evaluation.feedbacks.map((fb) => (
              <div key={fb.feedback}>{fb.feedback}</div>
            ))}
          </div>

          {Object.entries(evaluation.choices).map(([ix, value]) => (
            <div key={value as string}>{value as string}</div>
          ))}
        </div>
      )

    case QuestionType.FREE_TEXT:
      return <div></div>

    case QuestionType.NUMERICAL:
      return <div></div>

    default:
      return <div></div>
  }
}

function LearningElement() {
  const [response, setResponse] = useState<number[] | string | null>(null)
  const [currentIx, setCurrentIx] = useState(0)

  const router = useRouter()

  const { loading, error, data } = useQuery(GetLearningElementDocument, {
    variables: {
      id: router.query.id as string,
    },
    skip: !router.query.id,
  })

  const [respondToQuestionInstance] = useMutation(
    ResponseToQuestionInstanceDocument
  )

  if (loading || !data) return <p>Loading...</p>
  if (error) return <p>Oh no... {error.message}</p>

  const currentInstance = data.learningElement?.instances?.[currentIx]
  const questionData = currentInstance?.questionData

  const isEvaluation = !!currentInstance?.evaluation

  const handleSubmitResponse = () => {
    if (!response) return

    respondToQuestionInstance({
      variables: {
        id: currentInstance?.id as string,
        response:
          questionData?.type === QuestionType.SC ||
          questionData?.type === QuestionType.MC
            ? {
                choices: response as number[],
              }
            : { value: response as string },
      },
    })
  }

  const handleNextQuestion = () => {
    setCurrentIx((ix) => ix + 1)
    setResponse(null)
  }

  return (
    <div className="flex flex-col max-w-6xl m-auto">
      <div className="flex flex-row items-center justify-between px-4 py-2 font-bold text-white bg-uzh-blue-100">
        <div className="">Banking and Finance I</div>
        <div className="relative w-auto h-8 aspect-square">
          <Image
            className="rounded-full"
            src={PLACEHOLDER_IMG}
            alt="Participant Avatar"
            layout="fill"
          />
        </div>
      </div>
      <div className="p-4">
        {questionData && (
          <div className="flex flex-row gap-4">
            <div className="flex-1">
              <Prose className="px-2 py-1 mb-4 border rounded">
                {questionData.content}
              </Prose>
              <OptionsDisplay
                isEvaluation={isEvaluation}
                response={response}
                onChangeResponse={setResponse}
                onSubmitResponse={
                  isEvaluation ? handleNextQuestion : handleSubmitResponse
                }
                questionType={questionData.type}
                options={questionData.options}
              />
            </div>
            <div className="flex-1 p-4 bg-gray-100 rounded">
              {currentInstance.evaluation && (
                <EvaluationDisplay
                  questionType={questionData.type}
                  repsonse={response}
                  options={questionData.options}
                  evaluation={currentInstance.evaluation}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <Progress
          formatter={(v) => v}
          value={currentIx}
          max={data.learningElement?.instances?.length ?? 0}
        />
      </div>
    </div>
  )
}

export default LearningElement
