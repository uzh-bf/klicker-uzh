import { normalizeNumericalResponse } from '@klicker-uzh/adaptive-learning'
import {
  AdaptivePracticeQuizResponseInput,
  ElementType,
  FAdaptivePracticeQuizAttemptStateFragment,
} from '@klicker-uzh/graphql/dist/ops'
import QuestionContent from '@klicker-uzh/shared-components/src/QuestionContent'
import { FREETextAnswerOptions } from '@klicker-uzh/shared-components/src/questions/FREETextAnswerOptions'
import { KPAnswerOptions } from '@klicker-uzh/shared-components/src/questions/KPAnswerOptions'
import { MCAnswerOptions } from '@klicker-uzh/shared-components/src/questions/MCAnswerOptions'
import { SCAnswerOptions } from '@klicker-uzh/shared-components/src/questions/SCAnswerOptions'
import { Button, TextField, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LAYOUT_SCROLL_CONTAINER_ID } from '../../Layout'

type ServedItem = NonNullable<
  FAdaptivePracticeQuizAttemptStateFragment['servedItem']
>
type ChoicesResponse = Record<number, boolean | undefined>

interface AdaptivePracticeQuizQuestionProps {
  item: ServedItem
  questionNumber: number
  answeredQuestions: number
  maximumQuestions: number
  elapsedSeconds: number | null
  showTimer: boolean
  submitting: boolean
  submissionError?: boolean
  onSubmit: (
    response: AdaptivePracticeQuizResponseInput,
    elapsedSeconds: number
  ) => void
}

function AdaptivePracticeQuizQuestion({
  item,
  questionNumber,
  answeredQuestions,
  maximumQuestions,
  elapsedSeconds,
  showTimer,
  submitting,
  submissionError = false,
  onSubmit,
}: AdaptivePracticeQuizQuestionProps) {
  const t = useTranslations()
  const [choicesResponse, setChoicesResponse] = useState<ChoicesResponse>({})
  const [textResponse, setTextResponse] = useState('')
  const [questionElapsedSeconds, setQuestionElapsedSeconds] = useState(0)
  const startedAt = useRef(Date.now())
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    setChoicesResponse({})
    setTextResponse('')
    setQuestionElapsedSeconds(0)
    startedAt.current = Date.now()
    document
      .getElementById(LAYOUT_SCROLL_CONTAINER_ID)
      ?.scrollTo({ top: 0, left: 0 })
    headingRef.current?.focus()
  }, [item.poolItemId])

  useEffect(() => {
    if (!showTimer) return

    const updateElapsedSeconds = () => {
      setQuestionElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000))
      )
    }
    updateElapsedSeconds()
    const interval = window.setInterval(updateElapsedSeconds, 1000)
    return () => window.clearInterval(interval)
  }, [item.poolItemId, showTimer])

  const numericalValidation = useMemo(() => {
    if (
      item.type !== ElementType.Numerical ||
      item.options.__typename !== 'AdaptivePracticeQuizNumericalOptions'
    ) {
      return null
    }

    const normalized = normalizeNumericalResponse(textResponse, {
      allowPercentInput: item.options.enablePercentInput,
    })
    const value = normalized.value
    const restrictions = item.options.restrictions
    const outsideRange =
      value !== null &&
      ((typeof restrictions?.min === 'number' && value < restrictions.min) ||
        (typeof restrictions?.max === 'number' && value > restrictions.max))

    return {
      valid: !normalized.error && value !== null && !outsideRange,
      outsideRange,
    }
  }, [item, textResponse])

  const response = buildResponse({ item, choicesResponse, textResponse })
  const isValid =
    response !== null &&
    (item.type !== ElementType.Numerical || numericalValidation?.valid === true)
  const cumulativeElapsedSeconds =
    elapsedSeconds ?? (answeredQuestions === 0 ? 0 : null)

  return (
    <section
      className="mx-auto w-full max-w-4xl space-y-5"
      data-cy="adaptive-practice-quiz-question"
    >
      <div className="flex flex-col gap-1 border-b pb-3 sm:flex-row sm:items-end sm:justify-between">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="focus:outline-primary-80 rounded-sm font-semibold focus:outline focus:outline-2 focus:outline-offset-2"
          data-cy="adaptive-question-progress"
        >
          {t('pwa.practiceQuiz.adaptive.question.progress', {
            current: questionNumber,
            maximum: maximumQuestions,
          })}
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
          <span aria-live="polite">
            {answeredQuestions < 3
              ? t('pwa.practiceQuiz.adaptive.question.status.building')
              : t('pwa.practiceQuiz.adaptive.question.status.refining')}
          </span>
          {showTimer && cumulativeElapsedSeconds !== null && (
            <span
              className="font-medium tabular-nums"
              data-cy="adaptive-question-timer"
            >
              {t('pwa.practiceQuiz.adaptive.question.timer', {
                time: formatElapsedSeconds(
                  cumulativeElapsedSeconds + questionElapsedSeconds
                ),
              })}
            </span>
          )}
        </div>
      </div>

      <div>
        <QuestionContent content={item.content} noPoints={false} />
        <AdaptiveAnswerOptions
          item={item}
          choicesResponse={choicesResponse}
          textResponse={textResponse}
          disabled={submitting}
          numericalValidation={numericalValidation}
          onChoicesChange={setChoicesResponse}
          onTextChange={setTextResponse}
        />
      </div>

      {submissionError && (
        <UserNotification
          type="error"
          message={t('pwa.practiceQuiz.adaptive.errors.submit')}
        />
      )}

      <div className="flex justify-end border-t pt-4">
        <Button
          primary
          fluid
          disabled={!isValid || submitting}
          loading={submitting}
          onClick={() => {
            if (!response || !isValid) return
            onSubmit(
              response,
              Math.max(0, Math.round((Date.now() - startedAt.current) / 1000))
            )
          }}
          data={{ cy: 'submit-adaptive-practice-quiz-response' }}
          className={{ root: 'sm:w-auto' }}
        >
          <Button.Label>
            {t(
              submissionError
                ? 'shared.generic.tryAgain'
                : 'pwa.practiceQuiz.adaptive.actions.submit'
            )}
          </Button.Label>
        </Button>
      </div>
    </section>
  )
}

function formatElapsedSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const paddedSeconds = String(seconds).padStart(2, '0')

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`
}

function AdaptiveAnswerOptions({
  item,
  choicesResponse,
  textResponse,
  disabled,
  numericalValidation,
  onChoicesChange,
  onTextChange,
}: {
  item: ServedItem
  choicesResponse: ChoicesResponse
  textResponse: string
  disabled: boolean
  numericalValidation: { valid: boolean; outsideRange: boolean } | null
  onChoicesChange: (value: ChoicesResponse) => void
  onTextChange: (value: string) => void
}) {
  const t = useTranslations()

  if (
    item.options.__typename === 'AdaptivePracticeQuizChoicesOptions' &&
    [ElementType.Sc, ElementType.Mc, ElementType.Kprim].includes(item.type)
  ) {
    const choices = item.options.choices.map(({ ix, value }) => ({ ix, value }))

    if (item.type === ElementType.Sc) {
      return (
        <SCAnswerOptions
          displayMode={item.options.displayMode}
          choices={choices}
          value={choicesResponse}
          onChange={onChoicesChange}
          elementIx={0}
          disabled={disabled}
          hideFeedbacks
        />
      )
    }

    if (item.type === ElementType.Mc) {
      return (
        <MCAnswerOptions
          displayMode={item.options.displayMode}
          choices={choices}
          value={choicesResponse}
          onChange={onChoicesChange}
          elementIx={0}
          disabled={disabled}
          hideFeedbacks
        />
      )
    }

    return (
      <KPAnswerOptions
        displayMode={item.options.displayMode}
        type={ElementType.Kprim}
        choices={choices}
        value={choicesResponse}
        onChange={onChoicesChange}
        elementIx={0}
        disabled={disabled}
        hideFeedbacks
      />
    )
  }

  if (
    item.type === ElementType.Numerical &&
    item.options.__typename === 'AdaptivePracticeQuizNumericalOptions'
  ) {
    const restrictions = item.options.restrictions
    const showError = textResponse.length > 0 && !numericalValidation?.valid
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
          {typeof restrictions?.min === 'number' && (
            <span>
              {t('shared.generic.min')}: {restrictions.min}
            </span>
          )}
          {typeof restrictions?.max === 'number' && (
            <span>
              {t('shared.generic.max')}: {restrictions.max}
            </span>
          )}
          {item.options.enablePercentInput && (
            <span>
              {t('pwa.practiceQuiz.adaptive.validation.numericPercentAllowed')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TextField
            value={textResponse}
            onChange={onTextChange}
            aria-label={t('shared.NUMERICAL.text')}
            placeholder={item.options.placeholder ?? undefined}
            disabled={disabled}
            inputMode="decimal"
            error={
              showError
                ? numericalValidation?.outsideRange
                  ? typeof restrictions?.min === 'number' &&
                    typeof restrictions?.max === 'number'
                    ? t('pwa.practiceQuiz.adaptive.validation.numericRange', {
                        min: restrictions.min,
                        max: restrictions.max,
                      })
                    : typeof restrictions?.min === 'number'
                      ? t('pwa.practiceQuiz.adaptive.validation.numericMin', {
                          min: restrictions.min,
                        })
                      : typeof restrictions?.max === 'number'
                        ? t('pwa.practiceQuiz.adaptive.validation.numericMax', {
                            max: restrictions.max,
                          })
                        : t(
                            'pwa.practiceQuiz.adaptive.validation.numericInvalid'
                          )
                  : t('pwa.practiceQuiz.adaptive.validation.numericInvalid')
                : undefined
            }
            isTouched={showError}
            data={{ cy: 'adaptive-numerical-response' }}
            className={{ input: 'focus:border-primary-80' }}
          />
          {item.options.unit && (
            <span className="shrink-0 text-sm text-slate-700">
              {item.options.unit}
            </span>
          )}
        </div>
      </div>
    )
  }

  if (
    item.type === ElementType.FreeText &&
    item.options.__typename === 'AdaptivePracticeQuizFreeTextOptions'
  ) {
    return (
      <FREETextAnswerOptions
        value={textResponse}
        onChange={onTextChange}
        ariaLabel={t('shared.FREE_TEXT.text')}
        maxLength={item.options.restrictions?.maxLength ?? undefined}
        disabled={disabled}
        elementIx={0}
      />
    )
  }

  return (
    <UserNotification
      type="error"
      message={t('pwa.practiceQuiz.questionTypeNotSupported')}
    />
  )
}

function buildResponse({
  item,
  choicesResponse,
  textResponse,
}: {
  item: ServedItem
  choicesResponse: ChoicesResponse
  textResponse: string
}): AdaptivePracticeQuizResponseInput | null {
  if (item.type === ElementType.Sc || item.type === ElementType.Mc) {
    const choiceIndices = Object.entries(choicesResponse)
      .filter(([, selected]) => selected)
      .map(([ix]) => Number(ix))
    return choiceIndices.length > 0 ? { choiceIndices } : null
  }

  if (
    item.type === ElementType.Kprim &&
    item.options.__typename === 'AdaptivePracticeQuizChoicesOptions'
  ) {
    const allAnswered = item.options.choices.every(
      ({ ix }) => typeof choicesResponse[ix] === 'boolean'
    )
    if (!allAnswered) return null
    return {
      choiceIndices: item.options.choices
        .filter(({ ix }) => choicesResponse[ix] === true)
        .map(({ ix }) => ix),
    }
  }

  if (item.type === ElementType.Numerical) {
    return textResponse.trim() ? { numericalResponse: textResponse } : null
  }

  if (item.type === ElementType.FreeText) {
    return textResponse.trim() ? { freeTextResponse: textResponse } : null
  }

  return null
}

export default AdaptivePracticeQuizQuestion
