import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Choice } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { QuestionType } from '@type/app'
import { Button } from '@uzh-bf/design-system'
import { indexBy } from 'ramda'
import { useMemo } from 'react'
import NUMERICALAnswerOptions from 'shared-components/src/questions/NUMERICALAnswerOptions'
import { twMerge } from 'tailwind-merge'

interface ChoiceOptionsProps {
  disabled?: boolean
  choices: Choice[]
  isEvaluation?: boolean
  isCompact?: boolean
  feedbacks: any
  response?: number[]
  onChange: (ix: number) => void
}
function ChoiceOptions({
  disabled,
  choices,
  onChange,
  isEvaluation,
  feedbacks,
  response,
  isCompact,
}: ChoiceOptionsProps) {
  return (
    <div className={twMerge(isCompact ? 'flex flex-row gap-2' : 'space-y-2')}>
      {choices.map((choice) => (
        <div key={choice.value} className="w-full">
          <Button
            disabled={disabled || isEvaluation}
            active={response?.includes(choice.ix)}
            className={{
              root: twMerge(
                'px-4 py-3 text-sm border-uzh-blue-20 shadow-md',
                isEvaluation && 'text-gray-700',
                (disabled || isEvaluation) &&
                  response?.includes(choice.ix) &&
                  'border-gray-400 text-gray-800'
                // isEvaluation && response?.includes(choice.ix) && (choice.correct ? 'bg-green-200 border-green-300' : 'bg-red-200 border-red-300')
              ),
            }}
            fluid
            onClick={() => onChange(choice.ix)}
          >
            <Button.Label>
              <Markdown content={choice.value} />
            </Button.Label>
          </Button>
          {!isCompact && feedbacks?.[choice.ix] && (
            <div
              className={twMerge(
                'flex flex-row gap-3 items-center text-sm border rounded bg-gray-50'
              )}
            >
              <div
                className={twMerge(
                  'self-stretch px-3 w-8 py-2 text-xs bg-gray-300 flex text-gray-600 flex-col items-center justify-center',
                  response?.includes(choice.ix) &&
                    (feedbacks[choice.ix].correct
                      ? 'bg-green-200 text-green-700'
                      : 'bg-red-200 text-red-700')
                )}
              >
                <FontAwesomeIcon
                  icon={feedbacks[choice.ix].correct ? faCheck : faX}
                />
              </div>
              <div className="py-2 text-gray-700">
                <Markdown content={feedbacks[choice.ix].feedback} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

interface OptionsProps {
  disabled?: boolean
  options: any
  questionType: QuestionType
  isEvaluation?: boolean
  feedbacks: any
  response: any
  withGuidance?: boolean
  isCompact?: boolean
  isResponseValid: boolean
  onChangeResponse: (value: any) => void
}

export function Options({
  disabled,
  options,
  questionType,
  isEvaluation,
  feedbacks,
  response,
  isResponseValid,
  onChangeResponse,
  withGuidance,
  isCompact,
}: OptionsProps) {
  switch (questionType) {
    case QuestionType.SC:
      return (
        <div>
          {withGuidance && (
            <div className="mb-4 italic">
              Wähle <span className="font-bold">eine</span> der folgenden
              Optionen:
            </div>
          )}
          <ChoiceOptions
            disabled={disabled}
            choices={options.choices}
            isEvaluation={isEvaluation}
            feedbacks={feedbacks}
            response={response}
            onChange={(ix) => onChangeResponse([ix])}
            isCompact={isCompact}
          />
        </div>
      )

    case QuestionType.MC:
      return (
        <div>
          {withGuidance && (
            <div className="mb-4 italic">
              Wähle <span className="font-bold">eine oder mehrere</span> der
              folgenden Optionen:
            </div>
          )}
          <ChoiceOptions
            disabled={disabled}
            choices={options.choices}
            isEvaluation={isEvaluation}
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
            isCompact={isCompact}
          />
        </div>
      )

    case QuestionType.KPRIM:
      return (
        <div>
          {withGuidance && (
            <div className="mb-4 italic">
              Beurteile folgende Aussagen auf ihre{' '}
              <span className="font-bold">Richtigkeit</span>:
            </div>
          )}
          <div className="space-y-1">
            {options.choices.map((choice: Choice) => {
              const correctAnswer =
                (response?.includes(choice.ix) &&
                  feedbacks?.[choice.ix].correct) ||
                (!response?.includes(choice.ix) &&
                  !feedbacks?.[choice.ix].correct)

              return (
                <div className="flex flex-col" key={choice.ix}>
                  <div className="flex flex-row items-center justify-between gap-4 p-2 border">
                    <div>
                      <Markdown content={choice.value} />
                    </div>
                    <div className="flex flex-row gap-2">
                      <Button
                        className={{
                          root:
                            feedbacks &&
                            response?.includes(choice.ix) &&
                            (correctAnswer
                              ? 'bg-green-200 text-green-700'
                              : 'bg-red-200 text-red-700'),
                        }}
                        disabled={disabled || isEvaluation}
                        active={response?.includes(choice.ix)}
                        onClick={() =>
                          onChangeResponse((prev: any) => {
                            if (!prev) return [choice.ix]
                            if (!prev.includes(choice.ix)) {
                              return [...prev, choice.ix]
                            }
                          })
                        }
                      >
                        <Button.Icon>
                          <FontAwesomeIcon icon={faCheck} />
                        </Button.Icon>
                      </Button>
                      <Button
                        className={{
                          root:
                            feedbacks &&
                            !response?.includes(choice.ix) &&
                            (correctAnswer
                              ? 'bg-green-200 text-green-700'
                              : 'bg-red-200 text-red-700'),
                        }}
                        disabled={disabled || isEvaluation}
                        active={!response?.includes(choice.ix)}
                        onClick={() =>
                          onChangeResponse((prev: any) => {
                            if (!prev) return [choice.ix]
                            if (prev.includes(choice.ix)) {
                              return prev.filter((c: any) => c !== choice.ix)
                            }
                          })
                        }
                      >
                        <Button.Icon>
                          <FontAwesomeIcon icon={faX} />
                        </Button.Icon>
                      </Button>
                    </div>
                  </div>
                  {feedbacks?.[choice.ix] && (
                    <div
                      className={twMerge(
                        'flex flex-row gap-3 items-center text-sm border rounded bg-gray-50'
                      )}
                    >
                      {/* <div
                          className={twMerge(
                            'self-stretch px-3 w-8 py-2 text-xs bg-gray-300 flex text-gray-600 flex-col items-center justify-center',
                            correctAnswer
                              ? 'bg-green-200 text-green-700'
                              : 'bg-red-200 text-red-700'
                          )}
                        >
                          <FontAwesomeIcon
                            icon={correctAnswer ? faCheck : faX}
                          />
                        </div> */}
                      <div className="p-2 text-gray-700">
                        <Markdown content={feedbacks[choice.ix].feedback} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )

    case QuestionType.NUMERICAL:
      return (
        <div>
          {withGuidance && (
            <div className="mb-2 italic">
              Gib eine <span className="font-bold">Zahl</span> ein
              {options?.accuracy &&
                ` (gerundet auf ${options.accuracy} Nachkommastellen)`}
              :
            </div>
          )}
          <NUMERICALAnswerOptions
            disabled={disabled}
            accuracy={options?.accuracy}
            placeholder={options?.placeholder}
            unit={options?.unit}
            min={options?.restrictions?.min}
            max={options?.restrictions?.max}
            value={response}
            onChange={onChangeResponse}
            valid={isResponseValid}
          />
        </div>
      )

    default:
      return null
  }
}

Options.defaultProps = {
  withGuidance: true,
  isCompact: false,
  isResponseValid: true,
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
  const feedbacks = useMemo(() => {
    if (evaluation) {
      return indexBy((feedback: any) => feedback.ix, evaluation.feedbacks)
    }
  }, [evaluation])

  return (
    <div className="flex flex-col">
      <Options
        feedbacks={feedbacks}
        questionType={questionType}
        response={response}
        isEvaluation={isEvaluation}
        options={options}
        onChangeResponse={onChangeResponse}
      />
      <div className="self-end mt-4">
        <Button
          className={{ root: 'text-lg' }}
          disabled={
            !isEvaluation &&
            questionType !== QuestionType.KPRIM &&
            response?.length === 0
          }
          onClick={onSubmitResponse}
        >
          {isEvaluation ? 'Weiter' : 'Antwort absenden'}
        </Button>
      </div>
    </div>
  )
}

export default OptionsDisplay
