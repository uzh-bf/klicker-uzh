import { QuestionStack, QuestionType } from '@klicker-uzh/graphql/dist/ops'
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
  const [responses, setResponses] = useState<
    Record<string, {} | number[] | string | null>
  >({})

  // const [respondToQuestionInstance] = useMutation(
  //   ResponseToQuestionInstanceDocument
  // )

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
    })
    return () => setResponses({})
  }, [stack])

  console.log(responses)

  // const handleSubmitResponse = () => {
  //   // TODO: check if use here or on single question

  //   if (!response) return
  //   scrollTo(0, 0)

  //   respondToQuestionInstance({
  //     variables: {
  //       courseId: router.query.courseId as string,
  //       id: currentInstance?.id as number,
  //       response: formatResponse(questionData, response),
  //     },
  //   })
  // }

  console.log(stack)

  return (
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
  )
}

export default QuestionStack
