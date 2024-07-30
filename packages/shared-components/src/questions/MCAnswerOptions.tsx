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

export interface MCAnswerOptionsProps {
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
          <div key={`mc-choice-${index}-${choice.value}`}>
            <Button
              fluid
              className={{
                root: twMerge(
                  'min-h-[2.5rem] border-slate-400 hover:bg-unset',
                  !hideFeedbacks &&
                    feedbacks &&
                    feedbacks[index] &&
                    'rounded-b-none'
                ),
              }}
              onClick={() => onChange({ ...value, [index]: !value?.[index] })}
              active={value?.[index]}
              data={{ cy: `mc-${elementIx + 1}-answer-option-${index + 1}` }}
              disabled={disabled}
            >
              <Button.Label>
                <Markdown
                  withProse
                  content={choice.value}
                  className={{
                    root: 'p-1 pt-2 prose-img:!m-0 max-w-none prose-p:!m-0',
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

export default MCAnswerOptions
