import type { Choice, QuestionFeedback } from '@klicker-uzh/graphql/dist/ops'
import { ElementDisplayMode, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useId } from 'react'
import { twMerge } from 'tailwind-merge'
import ChoiceFeedback from '../evaluation/ChoiceFeedback'
import type { ChoicesStudentResponseType } from '../StudentElement'

export interface MCAnswerOptionsProps {
  displayMode?: ElementDisplayMode
  choices: Choice[]
  feedbacks?: QuestionFeedback[] | null
  value?: ChoicesStudentResponseType
  onChange: (value: ChoicesStudentResponseType) => void
  id?: string
  elementIx: number
  disabled: boolean
  hideFeedbacks?: boolean
  questionLabelId?: string
}

export function MCAnswerOptions({
  displayMode,
  choices,
  feedbacks,
  value,
  onChange,
  elementIx,
  disabled,
  hideFeedbacks = false,
  questionLabelId,
}: MCAnswerOptionsProps): React.ReactElement {
  const t = useTranslations()
  const questionId = useId()
  const instructionId = `${questionId}-instructions`

  return (
    <>
      <div id={instructionId} className="mb-2 text-base">
        {t.rich(`shared.${ElementType.Mc}.richtext`, {
          b: (text) => <span className="font-bold">{text}</span>,
        })}
      </div>
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
          const hasFeedback =
            !hideFeedbacks && feedbacks && feedbacks[choice.ix]
          const choiceLabelId = `${questionId}-choice-${choice.ix}`

          return (
            <div key={`mc-choice-${choice.ix}-${choice.value}`}>
              <div
                className={twMerge(
                  'relative min-h-11',
                  !hasFeedback && 'h-full'
                )}
              >
                <Button
                  fluid
                  className={{
                    root: twMerge(
                      'absolute inset-0 z-0 h-full min-h-11 border-slate-400',
                      hasFeedback && 'rounded-b-none',
                      disabled &&
                        'bg-accent disabled:hover:bg-accent disabled:opacity-90',
                      value?.[choice.ix] &&
                        'bg-primary-20 border-primary-100 hover:bg-primary-20 disabled:hover:bg-primary-20'
                    ),
                  }}
                  aria-labelledby={choiceLabelId}
                  aria-pressed={value?.[choice.ix] === true}
                  onClick={() =>
                    onChange({ ...value, [choice.ix]: !value?.[choice.ix] })
                  }
                  data={{
                    cy: `mc-${elementIx}-answer-option-${choice.ix}`,
                  }}
                  disabled={disabled}
                />
                <div
                  id={choiceLabelId}
                  className="relative z-10 flex items-start gap-2 pointer-events-none p-1 pt-2"
                >
                  <span
                    aria-hidden="true"
                    className={twMerge(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                      value?.[choice.ix]
                        ? 'border-primary-100 bg-primary-100 text-white'
                        : 'border-slate-400 text-transparent'
                    )}
                  >
                    ●
                  </span>
                  <Markdown
                    withProse
                    content={choice.value}
                    expandLabel={t('shared.generic.expandImage')}
                    className={{
                      root: 'min-w-0 break-words pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_video]:pointer-events-auto [&_input]:pointer-events-auto [&_iframe]:pointer-events-auto prose-p:m-0! prose-ul:my-0 prose-ol:my-0 max-w-none',
                    }}
                  />
                </div>
              </div>
              {hasFeedback && (
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

export default MCAnswerOptions
