import { Choice } from '@klicker-uzh/graphql/dist/ops'
import { shuffle } from '@klicker-uzh/graphql/dist/util'
import { QuestionType } from '@type/app'
import { Button } from '@uzh-bf/design-system'
import { useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { indexBy } from 'ramda'
import Markdown from '@klicker-uzh/markdown'

interface ChoiceOptionsProps {
  choices: Choice[]
  isEvaluation?: boolean
  feedbacks: any
  response?: number[]
  onChange: (ix: number) => void
}
function ChoiceOptions({
  choices,
  onChange,
  isEvaluation,
  feedbacks,
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
            <Button.Label><Markdown content={choice.value}/></Button.Label>
          </Button>
          {feedbacks?.[choice.ix] && <div className="p-1 text-sm">{feedbacks[choice.ix].feedback}</div>}
        </div>
      ))}
    </div>
  )
}

interface OptionsProps {
  options: any
  questionType: QuestionType
  isEvaluation?: boolean
  evaluation: any
  feedbacks: any
  response: any
  onChangeResponse: (value: any) => void
}

function Options({
  options,
  questionType,
  isEvaluation,
  evaluation,
  feedbacks,
  response,
  onChangeResponse,
}: OptionsProps) {
  switch (questionType) {
    case QuestionType.SC:
      return (
        <div>
          <div className="mb-2 italic">Wähle eine der folgenden Optionen.</div>
          <ChoiceOptions
            choices={options.choices}
            isEvaluation={isEvaluation}
            evaluation={evaluation}
            feedbacks={feedbacks}
            response={response}
            onChange={(ix) => onChangeResponse([ix])}
          />
        </div>
      )

    case QuestionType.MC:
      return (
        <div>
          <div className="mb-2 italic">
            Wähle eine oder mehrere der folgenden Optionen.
          </div>
          <ChoiceOptions
            choices={options.choices}
            isEvaluation={isEvaluation}
            evaluation={evaluation}
            feedbacks={feedbacks}
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
        </div>
      )

    default:
      return null
  }
}

interface OptionsDisplayProps {
  questionType: QuestionType
  evaluation: any
  options: any
  response: any
  onChangeResponse: any
  onSubmitResponse: any
  isEvaluation?: boolean
}

function OptionsDisplay({
  isEvaluation,
  evaluation,
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

  const feedbacks = useMemo(() => {
    if (evaluation) {
      return indexBy((feedback: any) => feedback.ix, evaluation.feedbacks)
    }
  }, [evaluation])


  return (
    <div className="flex flex-col">
      <Options
        evaluation={evaluation}
        feedbacks={feedbacks}
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
