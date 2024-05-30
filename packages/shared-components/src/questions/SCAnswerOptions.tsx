import {
  Choice,
  ElementDisplayMode,
  QuestionFeedback,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import ChoiceFeedback from '../evaluation/ChoiceFeedback'

export interface SCAnswerOptionsProps {
  displayMode?: ElementDisplayMode
  choices: Partial<Choice>[]
  feedbacks?: QuestionFeedback[] | null
  value?: Record<number, boolean>
  onChange: (value: Record<number, boolean>) => void
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
  return (
    <div
      className={twMerge(
        'gap-3',
        displayMode === ElementDisplayMode.Grid
          ? 'grid grid-cols-2'
          : 'flex flex-col'
      )}
    >
      {choices.map((choice, index) => {
        return (
          <div key={`sc-choice-${index}-${choice.value}`}>
            <Button
              fluid
              className={{
                root: twMerge(
                  'sm:hover:bg-unset min-h-[2.5rem] border-slate-400',
                  !hideFeedbacks &&
                    feedbacks &&
                    feedbacks[index] &&
                    'rounded-b-none'
                ),
              }}
              onClick={() =>
                onChange(
                  Object.fromEntries(choices.map((_, i) => [i, i === index]))
                )
              }
              active={value?.[index]}
              data={{ cy: `sc-${elementIx + 1}-answer-option-${index + 1}` }}
              disabled={disabled}
            >
              <Button.Label>
                <Markdown
                  withProse
                  content={choice.value}
                  className={{
                    root: 'max-w-none p-1 pt-2 prose-p:!m-0 prose-img:!m-0',
                  }}
                />
              </Button.Label>
            </Button>
            {!hideFeedbacks && feedbacks && feedbacks[index] && (
              <ChoiceFeedback feedback={feedbacks[index]} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default SCAnswerOptions
