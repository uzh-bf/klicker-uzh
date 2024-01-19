import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Choice,
  ChoiceQuestionOptions,
  ElementDisplayMode,
  ElementType,
  FreeTextQuestionOptions,
  NumericalQuestionOptions,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import FREETextAnswerOptions from '@klicker-uzh/shared-components/src/questions/FREETextAnswerOptions'
import NUMERICALAnswerOptions from '@klicker-uzh/shared-components/src/questions/NUMERICALAnswerOptions'
import {
  validateFreeTextResponse,
  validateKprimResponse,
  validateMcResponse,
  validateNumericalResponse,
  validateScResponse,
} from '@klicker-uzh/shared-components/src/utils/validateResponse'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { indexBy } from 'ramda'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface ChoiceOptionsProps {
  disabled?: boolean
  choices: Choice[]
  isEvaluation?: boolean
  isCompact?: boolean
  feedbacks: any
  response?: number[]
  onChange: (ix: number) => void
  displayMode?: ElementDisplayMode | null
}
function ChoiceOptions({
  disabled,
  choices,
  onChange,
  isEvaluation,
  feedbacks,
  response,
  isCompact,
  displayMode,
}: ChoiceOptionsProps) {
  return (
    <div
      className={twMerge(
        displayMode === ElementDisplayMode.Grid
          ? 'grid grid-cols-2 gap-3'
          : isCompact
          ? 'flex flex-row gap-2'
          : 'space-y-2'
      )}
    >
      {choices.map((choice) => (
        <div key={choice.value} className="w-full">
          <Button
            disabled={disabled || isEvaluation}
            active={Array.isArray(response) && response?.includes(choice.ix)}
            className={{
              root: twMerge(
                'px-4 py-3 text-sm shadow-md border-primary-40 h-full',
                isEvaluation && 'text-gray-700',
                (disabled || isEvaluation) &&
                  response?.includes(choice.ix) &&
                  'border-gray-400 text-gray-800'
              ),
            }}
            fluid
            onClick={() => onChange(choice.ix)}
            data={{ cy: 'choice-option' }}
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
  options:
    | ChoiceQuestionOptions
    | NumericalQuestionOptions
    | FreeTextQuestionOptions
  questionType: ElementType
  isEvaluation?: boolean
  feedbacks: any
  response: any
  withGuidance?: boolean
  isCompact?: boolean
  onChangeResponse: (value: any) => void
  displayMode?: ElementDisplayMode | null
}

export function Options({
  disabled,
  options,
  questionType,
  isEvaluation,
  feedbacks,
  response,
  onChangeResponse,
  withGuidance = true,
  isCompact = false,
}: OptionsProps) {
  const t = useTranslations()

  switch (questionType) {
    case ElementType.Sc: {
      const questionOptions = options as ChoiceQuestionOptions

      return (
        <div>
          {typeof withGuidance !== 'undefined' && withGuidance && (
            <div className="mb-4 italic">
              {t.rich(`shared.${ElementType.Sc}.richtext`, {
                b: (text) => <span className="font-bold">{text}</span>,
              })}
            </div>
          )}
          <ChoiceOptions
            disabled={disabled}
            choices={questionOptions.choices}
            isEvaluation={isEvaluation}
            feedbacks={feedbacks}
            response={response}
            onChange={(ix) => onChangeResponse([ix])}
            isCompact={isCompact}
            displayMode={questionOptions.displayMode}
          />
        </div>
      )
    }

    case ElementType.Mc: {
      const questionOptions = options as ChoiceQuestionOptions

      return (
        <div>
          {typeof withGuidance !== 'undefined' && withGuidance && (
            <div className="mb-4 italic">
              {t.rich(`shared.${ElementType.Mc}.richtext`, {
                b: (text) => <span className="font-bold">{text}</span>,
              })}
            </div>
          )}
          <ChoiceOptions
            disabled={disabled}
            choices={questionOptions.choices}
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
            displayMode={questionOptions.displayMode}
          />
        </div>
      )
    }

    case ElementType.Kprim: {
      const questionOptions = options as ChoiceQuestionOptions

      return (
        <div>
          {typeof withGuidance !== 'undefined' && withGuidance && (
            <div className="mb-4 italic">
              {t.rich(`shared.${ElementType.Kprim}.richtext`, {
                b: (text) => <span className="font-bold">{text}</span>,
              })}
            </div>
          )}
          <div className="space-y-1">
            {questionOptions.choices.map((choice: Choice) => {
              const correctAnswer =
                (response?.[choice.ix] && feedbacks?.[choice.ix].correct) ||
                (!response?.[choice.ix] && !feedbacks?.[choice.ix].correct)

              return (
                <div className="flex flex-col" key={choice.value}>
                  <div className="flex flex-row items-center justify-between gap-4 p-2 border">
                    <div>
                      <Markdown content={choice.value} />
                    </div>
                    <div className="flex flex-row gap-2">
                      <Button
                        className={{
                          root:
                            feedbacks &&
                            response?.[choice.ix] &&
                            (correctAnswer
                              ? 'bg-green-200 text-green-700'
                              : 'bg-red-200 text-red-700'),
                        }}
                        disabled={disabled || isEvaluation}
                        active={response?.[choice.ix] === true}
                        onClick={() =>
                          onChangeResponse((prev: any) => {
                            return { ...prev, [choice.ix]: true }
                          })
                        }
                        data={{ cy: `toggle-KPRIM-ix-${choice.value}-correct` }}
                      >
                        <Button.Icon>
                          <FontAwesomeIcon icon={faCheck} />
                        </Button.Icon>
                      </Button>
                      <Button
                        className={{
                          root:
                            feedbacks &&
                            !response?.[choice.ix] &&
                            (correctAnswer
                              ? 'bg-green-200 text-green-700'
                              : 'bg-red-200 text-red-700'),
                        }}
                        disabled={disabled || isEvaluation}
                        active={response?.[choice.ix] === false}
                        onClick={() =>
                          onChangeResponse((prev: any) => {
                            return { ...prev, [choice.ix]: false }
                          })
                        }
                        data={{
                          cy: `toggle-KPRIM-ix-${choice.value}-incorrect`,
                        }}
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
    }

    case ElementType.Numerical: {
      const questionOptions = options as NumericalQuestionOptions
      const min_restriction =
        questionOptions?.restrictions?.min !== null &&
        typeof questionOptions?.restrictions?.min !== 'undefined'
          ? questionOptions.restrictions.min
          : undefined
      const max_restriction =
        questionOptions?.restrictions?.max !== null &&
        typeof questionOptions?.restrictions?.max !== 'undefined'
          ? questionOptions.restrictions.max
          : undefined
      const accuracy =
        questionOptions.accuracy !== null &&
        typeof questionOptions.accuracy !== 'undefined'
          ? questionOptions.accuracy
          : undefined

      return (
        <div>
          {typeof withGuidance !== 'undefined' && withGuidance && (
            <div className="mb-2 italic">
              {t.rich(`shared.${ElementType.Numerical}.richtext`, {
                b: (text) => <span className="font-bold">{text}</span>,
              })}{' '}
              {typeof questionOptions.accuracy === 'number' &&
                t('shared.questions.roundedTo', {
                  accuracy: questionOptions.accuracy,
                })}
            </div>
          )}
          <NUMERICALAnswerOptions
            disabled={disabled || isEvaluation}
            accuracy={accuracy}
            placeholder={questionOptions?.placeholder ?? undefined}
            unit={questionOptions?.unit ?? undefined}
            min={min_restriction}
            max={max_restriction}
            value={response}
            onChange={onChangeResponse}
            valid={validateNumericalResponse({
              response,
              options: questionOptions,
            })}
            hidePrecision={typeof withGuidance !== 'undefined' && withGuidance}
          />
        </div>
      )
    }

    case ElementType.FreeText:
      const questionOptions = options as FreeTextQuestionOptions

      return (
        <div>
          {typeof withGuidance !== 'undefined' && withGuidance && (
            <div className="mb-4 italic">
              {t.rich(`shared.${ElementType.FreeText}.richtext`, {
                b: (text) => <span className="font-bold">{text}</span>,
              })}
            </div>
          )}
          <FREETextAnswerOptions
            disabled={disabled}
            onChange={onChangeResponse}
            maxLength={questionOptions.restrictions?.maxLength ?? undefined}
            value={response}
          />
        </div>
      )

    default:
      return <div>{t('pwa.learningElement.questionTypeNotSupported')}</div>
  }
}

interface OptionsDisplayProps {
  questionType: ElementType
  evaluation: any
  options:
    | ChoiceQuestionOptions
    | NumericalQuestionOptions
    | FreeTextQuestionOptions
  response: any
  onChangeResponse: (value: any) => void
  onSubmitResponse?: any
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
  const t = useTranslations()
  const feedbacks = useMemo(() => {
    if (evaluation) {
      return indexBy((feedback: any) => feedback.ix, evaluation.feedbacks)
    }
  }, [evaluation])

  return (
    <div className="flex flex-col gap-4">
      <div className={twMerge(isEvaluation && 'order-2 md:order-1')}>
        <Options
          feedbacks={feedbacks}
          questionType={questionType}
          response={response}
          isEvaluation={isEvaluation}
          options={options}
          onChangeResponse={onChangeResponse}
        />
      </div>
      {onSubmitResponse && (
        <div
          className={twMerge(
            'flex flex-col items-end',
            isEvaluation &&
              'order-1 md:order-2 border-b md:border-0 pb-4 md:pb-0'
          )}
        >
          <Button
            className={{ root: 'text-lg' }}
            disabled={
              !(
                isEvaluation ||
                (questionType === ElementType.Sc &&
                  validateScResponse(response)) ||
                (questionType === ElementType.Mc &&
                  validateMcResponse(response)) ||
                (questionType === ElementType.Kprim &&
                  validateKprimResponse(response)) ||
                (questionType === ElementType.Numerical &&
                  validateNumericalResponse({
                    response,
                    options: options as NumericalQuestionOptions,
                  })) ||
                (questionType === ElementType.FreeText &&
                  validateFreeTextResponse({
                    response,
                    options: options as FreeTextQuestionOptions,
                  }))
              )
            }
            onClick={onSubmitResponse}
            data={{ cy: 'send-answer' }}
          >
            {isEvaluation
              ? t('shared.generic.continue')
              : t('shared.generic.sendAnswer')}
          </Button>
        </div>
      )}
    </div>
  )
}

export async function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default OptionsDisplay
