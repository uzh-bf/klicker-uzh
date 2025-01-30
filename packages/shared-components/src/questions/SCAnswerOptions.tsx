import type { Choice, QuestionFeedback } from '@klicker-uzh/graphql/dist/ops'
import { ElementDisplayMode, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import ChoiceFeedback from '../evaluation/ChoiceFeedback'
import type { ChoicesStudentResponseType } from '../StudentElement'

export interface SCAnswerOptionsProps {
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

export function SCAnswerOptions({
  displayMode,
  choices,
  feedbacks,
  value,
  onChange,
  elementIx,
  disabled,
  hideFeedbacks = false,
}: SCAnswerOptionsProps): React.ReactElement {
  const t = useTranslations()

  return (
    <>
      <div className="mb-2">
        {t.rich(`shared.${ElementType.Sc}.richtext`, {
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
            <div key={`sc-choice-${choice.ix}-${choice.value}`}>
              <Button
                fluid
                className={{
                  root: twMerge(
                    'hover:bg-unset min-h-[2.5rem] border-slate-400',
                    !hasFeedback && 'h-full',
                    hasFeedback && 'rounded-b-none'
                  ),
                }}
                onClick={() =>
                  onChange(
                    Object.fromEntries(
                      choices.map((_, i) => [i, i === choice.ix])
                    )
                  )
                }
                active={value?.[choice.ix]}
                data={{
                  cy: `sc-${elementIx + 1}-answer-option-${choice.ix + 1}`,
                }}
                disabled={disabled}
              >
                <Button.Label>
                  <Markdown
                    withProse
                    content={choice.value}
                    className={{
                      root: 'prose-p:!m-0 prose-img:!m-0 max-w-none p-1 pt-2',
                    }}
                  />
                </Button.Label>
              </Button>
              {hasFeedback && (
                <ChoiceFeedback feedback={feedbacks[choice.ix]!} />
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default SCAnswerOptions
