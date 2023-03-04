import { useMutation } from '@apollo/client'
import {
  QuestionStack,
  QuestionType,
  ResponseToQuestionInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import formatResponse from '@lib/formatResponse'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import DynamicMarkdown from './DynamicMarkdown'
import SingleQuestion from './SingleQuestion'

interface QuestionStackProps {
  stack: QuestionStack
  currentStep: number
  totalSteps: number
  handleNextQuestion: () => void
}

function QuestionStack({
  stack,
  currentStep,
  totalSteps,
  handleNextQuestion,
}: QuestionStackProps) {
  const t = useTranslations()
  const router = useRouter()

  const [responses, setResponses] = useState<
    Record<string, {} | number[] | string | null>
  >({})
  const [isEvaluation, setIsEvaluation] = useState(false)

  const [respondToQuestionInstance] = useMutation(
    ResponseToQuestionInstanceDocument
  )

  useEffect(() => {
    stack.elements?.map((element) => {
      if (element.mdContent) return

      const questionType = element.questionInstance?.questionData.type
      if (
        questionType === QuestionType.Sc ||
        questionType === QuestionType.Mc
      ) {
        setResponses((prev) => ({
          ...prev,
          [element.id]: [],
        }))
      } else if (questionType === QuestionType.Kprim) {
        setResponses((prev) => ({
          ...prev,
          [element.id]: {},
        }))
      } else {
        setResponses((prev) => ({
          ...prev,
          [element.id]: '',
        }))
      }

      if (element.questionInstance?.evaluation) {
        setIsEvaluation(true)
      }
    })

    return () => {
      setResponses({})
      setIsEvaluation(false)
    }
  }, [stack])

  console.log(responses)

  const handleSubmitResponse = async () => {
    const responsePromises = Object.keys(responses).map((key) => {
      const element = stack.elements?.find((el) => el.id === parseInt(key))
      if (!element?.questionInstance) return

      return respondToQuestionInstance({
        variables: {
          courseId: router.query.courseId as string,
          id: element.questionInstance.id,
          response: formatResponse(
            element.questionInstance.questionData,
            responses[key]
          ),
        },
      })
    })

    await Promise.all(responsePromises)
  }

  return (
    <div>
      <div>
        {stack.elements?.map((element) => {
          if (element.mdContent) {
            return (
              <div
                key={element.id}
                className="py-2 my-4 border-b-2 border-red-400 border-solid last:border-none"
              >
                <DynamicMarkdown content={element.mdContent} />
              </div>
            )
          }
          if (element.questionInstance) {
            return (
              <div
                key={element.id}
                className="py-2 my-4 border-b-2 border-red-400 border-solid last:border-none"
              >
                <SingleQuestion
                  instance={element.questionInstance}
                  currentStep={currentStep}
                  totalSteps={totalSteps}
                  response={responses[element.id]}
                  setResponse={(response) =>
                    setResponses((prev) => ({
                      ...prev,
                      [element.id]: response,
                    }))
                  }
                />
              </div>
            )
          }
          return <div key={element.id}>Loading...</div>
        })}
      </div>
      <Button
        className={{ root: 'float-right' }}
        onClick={
          isEvaluation
            ? () => handleNextQuestion()
            : () => handleSubmitResponse()
        }
      >
        {isEvaluation
          ? t('shared.generic.continue')
          : t('shared.generic.sendAnswer')}
      </Button>
    </div>
  )
}

export default QuestionStack
