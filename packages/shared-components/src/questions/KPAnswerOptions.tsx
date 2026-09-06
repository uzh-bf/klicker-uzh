import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import type { Choice, QuestionFeedback } from '@klicker-uzh/graphql/dist/ops'
import { ElementDisplayMode, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useId } from 'react'
import { twMerge } from 'tailwind-merge'
import ChoiceFeedback from '../evaluation/ChoiceFeedback'
import type { ChoicesStudentResponseType } from '../StudentElement'

export interface KPAnswerOptionsProps {
  displayMode?: ElementDisplayMode
  type: ElementType
  choices: Choice[]
  feedbacks?: QuestionFeedback[] | null
  value?: ChoicesStudentResponseType
  onChange: (newValue: ChoicesStudentResponseType) => void
  id?: string
  elementIx: number
  disabled: boolean
  hideFeedbacks?: boolean
  questionLabelId?: string
}

export function KPAnswerOptions({
  displayMode,
  choices,
  feedbacks,
  value,
  onChange,
  elementIx,
  disabled,
  hideFeedbacks = false,
  questionLabelId,
}: KPAnswerOptionsProps): React.ReactElement {
  const t = useTranslations()
  const questionId = useId()
  const instructionId = `${questionId}-instructions`

  return (
    <>
      <span id={instructionId} className="sr-only">
        {t('shared.KPRIM.text')}
      </span>
      <div
        role="group"
        aria-labelledby={
          questionLabelId
            ? `${questionLabelId} ${instructionId}`
            : instructionId
        }
        className={twMerge(
          'gap-3',
          displayMode === ElementDisplayMode.Grid
            ? 'grid grid-cols-1 sm:grid-cols-2'
            : 'flex flex-col'
        )}
      >
        {choices.map((choice) => {
          const choiceLabelId = `${questionId}-choice-${choice.ix}`
          const correctLabelId = `${choiceLabelId}-correct`
          const incorrectLabelId = `${choiceLabelId}-incorrect`

          return (
            <div key={`kp-choice-${choice.ix}-${choice.value}`}>
              <div
                className={twMerge(
                  'flex flex-row items-center justify-between gap-4 rounded border p-2',
                  !hideFeedbacks &&
                    feedbacks &&
                    feedbacks[choice.ix] &&
                    'rounded-b-none!'
                )}
                data-cy="kp-answer-options"
              >
                <div id={choiceLabelId} className="relative">
                  <Markdown
                    withProse
                    content={choice.value}
                    expandLabel={t('shared.generic.expandImage')}
                    className={{
                      root: 'prose-p:m-0! prose-img:m-0! max-w-none p-1 pt-2',
                    }}
                  />
                </div>
                <div className="flex flex-row gap-2">
                  <Button
                    className={{
                      root: twMerge(
                        'p-0! disabled:bg-accent disabled:hover:bg-accent h-11 w-11 border-slate-400 disabled:cursor-not-allowed disabled:opacity-90',
                        value?.[choice.ix] === true &&
                          'bg-primary-20 disabled:bg-primary-20 border-primary-100 ring-2 ring-primary-100 hover:bg-primary-20 disabled:hover:bg-primary-20 disabled:cursor-not-allowed',
                        feedbacks?.[choice.ix]?.correct === true &&
                          'border-2 border-green-600',
                        feedbacks?.[choice.ix]?.correct === false &&
                          'border-2 border-red-600'
                      ),
                    }}
                    aria-labelledby={`${choiceLabelId} ${correctLabelId}`}
                    aria-pressed={value?.[choice.ix] === true}
                    onClick={() => onChange({ ...value, [choice.ix]: true })}
                    data={{
                      cy: `toggle-kp-${elementIx}-answer-${choice.ix}-correct`,
                    }}
                    disabled={disabled}
                  >
                    <span id={correctLabelId} className="sr-only">
                      {t('shared.generic.correct')}
                    </span>
                    <Button.Icon
                      withoutLabel
                      icon={faCheck}
                      className={{ root: 'h-[1.2rem] w-[1.2rem]' }}
                    />
                  </Button>
                  <Button
                    className={{
                      root: twMerge(
                        'disabled:bg-accent disabled:hover:bg-accent h-11 w-11 border-slate-400 disabled:cursor-not-allowed disabled:opacity-90',
                        value?.[choice.ix] === false &&
                          'bg-primary-20 disabled:bg-primary-20 border-primary-100 ring-2 ring-primary-100 hover:bg-primary-20 disabled:hover:bg-primary-20 disabled:cursor-not-allowed',
                        feedbacks?.[choice.ix]?.correct === false &&
                          'border-2 border-green-600',
                        feedbacks?.[choice.ix]?.correct === true &&
                          'border-2 border-red-600'
                      ),
                    }}
                    aria-labelledby={`${choiceLabelId} ${incorrectLabelId}`}
                    aria-pressed={value?.[choice.ix] === false}
                    onClick={() => onChange({ ...value, [choice.ix]: false })}
                    data={{
                      cy: `toggle-kp-${elementIx}-answer-${choice.ix}-incorrect`,
                    }}
                    disabled={disabled}
                  >
                    <span id={incorrectLabelId} className="sr-only">
                      {t('manage.assessment.liveQuizIncorrect')}
                    </span>
                    <Button.Icon
                      withoutLabel
                      icon={faX}
                      className={{ root: 'h-[1.2rem] w-[1.2rem]' }}
                    />
                  </Button>
                </div>
              </div>
              {!hideFeedbacks && feedbacks && feedbacks[choice.ix] && (
                <ChoiceFeedback
                  elementIx={elementIx}
                  choiceIx={choice.ix}
                  feedback={feedbacks[choice.ix]!}
                />
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default KPAnswerOptions
