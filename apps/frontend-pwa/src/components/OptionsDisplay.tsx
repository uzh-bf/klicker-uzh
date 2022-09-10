import { Choice } from '@klicker-uzh/graphql/dist/ops'
import { shuffle } from '@klicker-uzh/graphql/dist/util'
import { QuestionType } from '@type/app'
import { Button } from '@uzh-bf/design-system'
import { useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface ChoiceOptionsProps {
  choices: Choice[]
  isEvaluation?: boolean
  response?: number[]
  onChange: (ix: number) => void
}
function ChoiceOptions({
  choices,
  onChange,
  isEvaluation,
  response,
}: ChoiceOptionsProps) {
  const shuffledChoices: Choice[] = useMemo(() => shuffle(choices), [choices])

  return (
    <div className="space-y-2">
      {shuffledChoices.map((choice) => (
        <div key={choice.value} className="w-full">
          <Button
            disabled={isEvaluation}
            active={response?.includes(choice.ix)}
            className={twMerge(
              'px-4 py-2 text-sm border-uzh-blue-20',
              response?.includes(choice.ix) && 'border-uzh-blue-100',
              isEvaluation && 'text-gray-700',
              choice.correct && 'bg-green-300 border-green-600'
            )}
            fluid
            onClick={() => onChange(choice.ix)}
          >
            <Button.Label>{choice.value}</Button.Label>
          </Button>
        </div>
      ))}
    </div>
  )
}

interface OptionsProps {
  options: any
  questionType: QuestionType
  isEvaluation?: boolean
  response: any
  onChangeResponse: (value: any) => void
}

function Options({
  options,
  questionType,
  isEvaluation,
  response,
  onChangeResponse,
}: OptionsProps) {
  switch (questionType) {
    case QuestionType.SC:
      return (
        <ChoiceOptions
          choices={options.choices}
          isEvaluation={isEvaluation}
          response={response}
          onChange={(ix) => onChangeResponse([ix])}
        />
      )

    case QuestionType.MC:
      return (
        <ChoiceOptions
          choices={options.choices}
          isEvaluation={isEvaluation}
          response={response}
          onChange={(ix) =>
            onChangeResponse((prev: any) => {
              if (!prev) return [ix]
              if (prev.includes(ix)) {
                return prev.filter((c: any) => c !== ix)
              } else {
                return [...prev, ix]
              }
            })
          }
        />
      )

    default:
      return null
  }
}

interface OptionsDisplayProps {
  questionType: QuestionType
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
}: OptionsDisplayProps) {
  useEffect(() => {
    if (questionType === QuestionType.SC || questionType === QuestionType.MC) {
      onChangeResponse([])
    } else if (questionType === QuestionType.FREE_TEXT) {
    } else if (questionType === QuestionType.NUMERICAL) {
    }
  }, [questionType, onChangeResponse])

  return (
    <div className="flex flex-col">
      <Options
        questionType={questionType}
        response={response}
        isEvaluation={isEvaluation}
        options={options}
        onChangeResponse={onChangeResponse}
      />
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
}

export default OptionsDisplay
