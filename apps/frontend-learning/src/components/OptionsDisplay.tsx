import { QuestionType } from '@type/app'
import { Button } from '@uzh-bf/design-system'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'

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

  switch (questionType) {
    case QuestionType.SC:
      return (
        <div className="flex flex-col">
          <div className="space-y-2">
            {options.choices?.map((choice: any, ix: number) => (
              <div key={choice.value} className="w-full">
                <Button
                  disabled={isEvaluation}
                  active={response?.includes(ix)}
                  className={twMerge(
                    'px-4 py-2 text-sm',
                    response?.includes(ix) && 'border-uzh-red-100',
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
              disabled={!isEvaluation && response?.length === 0}
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
                  disabled={isEvaluation}
                  active={response?.includes(ix)}
                  className={twMerge(
                    'px-4 py-2 text-sm',
                    response?.includes(ix) && 'border-uzh-red-100',
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
              disabled={!isEvaluation && response?.length === 0}
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

export default OptionsDisplay
