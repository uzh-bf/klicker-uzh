import { useMutation, useQuery } from '@apollo/client'
import EvaluationDisplay from '@components/EvaluationDisplay'
import OptionsDisplay from '@components/OptionsDisplay'
import {
  GetLearningElementDocument,
  ResponseToQuestionInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { QuestionType } from '@type/app'
import { Progress, Prose } from '@uzh-bf/design-system'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState } from 'react'

const PLACEHOLDER_IMG =
  'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/placeholder.png'

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

  console.log(currentInstance)

  const isEvaluation = !!currentInstance?.evaluation

  const handleSubmitResponse = () => {
    if (!response) return

    respondToQuestionInstance({
      variables: {
        courseId: router.query.courseId as string,
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
