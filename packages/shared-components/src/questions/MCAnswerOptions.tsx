import type { Choice, QuestionFeedback } from '@klicker-uzh/graphql/dist/ops'
import { ElementDisplayMode, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
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
}: MCAnswerOptionsProps): React.ReactElement {
  const t = useTranslations()

  return (
    <>
      <div className="mb-2 text-base">
        {t.rich(`shared.${ElementType.Mc}.richtext`, {
          b: (text) => <span className="font-bold">{text}</span>,
        })}
      </div>
      <div
        className={twMerge(
          'gap-3',
          displayMode === ElementDisplayMode.Grid
            ? 'grid grid-cols-2'
            : 'flex flex-col'
        )}
      >
        {choices.map((choice) => {
          const hasFeedback =
            !hideFeedbacks && feedbacks && feedbacks[choice.ix]

          return (
            <div key={`mc-choice-${choice.ix}-${choice.value}`}>
              <Button
                fluid
                className={{
                  root: twMerge(
                    'min-h-10 border-slate-400',
                    !hasFeedback && 'h-full',
                    hasFeedback && 'rounded-b-none',
                    disabled &&
                      'bg-accent disabled:hover:bg-accent disabled:opacity-90',
                    value?.[choice.ix] &&
                      'bg-primary-20 border-primary-100 hover:bg-primary-20 disabled:hover:bg-primary-20'
                  ),
                }}
                onClick={() =>
                  onChange({ ...value, [choice.ix]: !value?.[choice.ix] })
                }
                data={{
                  cy: `mc-${elementIx}-answer-option-${choice.ix}`,
                }}
                aria-pressed={Boolean(value?.[choice.ix])}
                disabled={disabled}
              >
                <Button.Label>
                  <Markdown
                    withProse
                    content={choice.value}
                    className={{
                      root: 'prose-p:m-0! prose-img:m-0! max-w-none p-1 pt-2',
                    }}
                  />
                </Button.Label>
              </Button>
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
