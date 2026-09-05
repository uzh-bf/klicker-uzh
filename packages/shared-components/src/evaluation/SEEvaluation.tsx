import type {
  SelectionElementOptions,
  SelectionInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import type { SingleSelectionResponse } from '@klicker-uzh/types'
import { Progress } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { prop, sortBy } from 'remeda'
import { twMerge } from 'tailwind-merge'

function SEEValuation({
  evaluation,
  options,
}: {
  evaluation: SelectionInstanceEvaluation
  options: SelectionElementOptions
}) {
  const t = useTranslations()

  // the number of answer options for which statistics are shown
  const numberOfShownResponses = Math.max(
    options.numberOfInputs! + 1,
    evaluation.answerSolutionIds?.length ?? 0
  )

  const sortedResponses = useMemo<
    (SingleSelectionResponse & { correct?: boolean })[]
  >(() => {
    if (
      typeof evaluation?.selectionResponses === 'undefined' ||
      evaluation?.selectionResponses === null ||
      options.numberOfInputs === null ||
      typeof options.numberOfInputs === 'undefined'
    ) {
      return []
    }

    const sorted = sortBy(evaluation.selectionResponses, [
      prop('count'),
      'desc',
    ]).slice(0, numberOfShownResponses)

    if (
      evaluation?.answerSolutionIds === null ||
      typeof evaluation?.answerSolutionIds === 'undefined'
    ) {
      return sorted
    }

    return sorted.map((entry) => ({
      ...entry,
      correct: evaluation.answerSolutionIds!.includes(entry.answerId),
    }))
  }, [evaluation?.selectionResponses])

  // get the values of the correct options
  const correctOptions = useMemo(() => {
    if (
      options.answerCollection?.entries === null ||
      typeof options.answerCollection?.entries === 'undefined' ||
      evaluation?.answerSolutionIds === null ||
      typeof evaluation?.answerSolutionIds === 'undefined'
    ) {
      return []
    }

    return options.answerCollection.entries
      .filter((entry) => evaluation?.answerSolutionIds!.includes(entry.id))
      .map((entry) => entry.value)
  }, [options.answerCollection])

  return (
    <>
      <div>
        <div className="font-bold">
          {t('pwa.practiceQuiz.correctAnswerOptions')}
        </div>
        <ul className="list-disc pl-4">
          {correctOptions.map((option, index) => (
            <li key={`correct-answer-${index}`}>{option}</li>
          ))}
        </ul>
      </div>
      <div>
        <div className="font-bold">
          {t('pwa.practiceQuiz.topNAnswers', {
            number: numberOfShownResponses,
          })}
        </div>
        <div className="flex flex-col gap-1">
          {sortedResponses.map((response, ix) => (
            <div key={`top-response-${response.answerId}`}>
              <div className="-mb-0.5 text-sm">{`${ix + 1}. ${response.value}`}</div>
              <Progress
                noMinWidth
                value={response.count}
                max={evaluation.numAnswers ?? 1}
                formatter={() => null}
                className={{
                  root: 'h-3.5',
                  background: twMerge(
                    'border border-red-600',
                    response.correct && 'border-green-600'
                  ),
                  indicator: twMerge(
                    'bg-red-600 px-0',
                    response.correct && 'bg-green-600'
                  ),
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default SEEValuation
