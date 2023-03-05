import { useMutation } from '@apollo/client'
import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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
import { twMerge } from 'tailwind-merge'
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
  const [informationOnly, setInformationOnly] = useState(true)

  const [respondToQuestionInstance] = useMutation(
    ResponseToQuestionInstanceDocument
  )

  useEffect(() => {
    stack.elements?.map((element) => {
      if (element.mdContent) return

      const questionType = element.questionInstance?.questionData.type
      setInformationOnly(false)
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
      setInformationOnly(true)
    }
  }, [stack])

  const handleSubmitResponse = async () => {
    const responsePromises = Object.entries(responses).map(
      ([key, response]) => {
        const element = stack.elements?.find((el) => el.id === parseInt(key))
        if (!element?.questionInstance) return

        return respondToQuestionInstance({
          variables: {
            courseId: router.query.courseId as string,
            id: element.questionInstance.id,
            response: formatResponse(
              element.questionInstance.questionData,
              response
            ),
          },
        })
      }
    )

    await Promise.all(responsePromises)
  }

  return (
    <div>
      <div className="">
        {stack.elements?.map((element) => {
          if (element.mdContent) {
            return (
              <div className="gap-8 md:flex md:flex-row" key={element.id}>
                <div
                  className={twMerge(
                    'flex-1 py-4 my-8 border-y',
                    isEvaluation && 'basis-2/3'
                  )}
                >
                  <DynamicMarkdown content={element.mdContent} />
                </div>
                {isEvaluation && <div className="flex-1 basis-1/3"></div>}
              </div>
            )
          }

          if (element.questionInstance) {
            return (
              <div key={element.id} className="">
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

          return (
            <div
              className="flex flex-col items-center justify-center h-28"
              key={element.id}
            >
              <FontAwesomeIcon icon={faSync} />
            </div>
          )
        })}
      </div>
      <Button
        className={{ root: 'float-right' }}
        onClick={
          isEvaluation || informationOnly
            ? () => handleNextQuestion()
            : () => handleSubmitResponse()
        }
      >
        {isEvaluation || informationOnly
          ? t('shared.generic.continue')
          : t('shared.generic.sendAnswer')}
      </Button>
    </div>
  )
}

export default QuestionStack
