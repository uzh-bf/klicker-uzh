import type { Choice, QuestionFeedback } from '@klicker-uzh/graphql/dist/ops'
import { ElementDisplayMode, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import ChoiceFeedback from '../evaluation/ChoiceFeedback'

export interface MCAnswerOptionsProps {
  displayMode?: ElementDisplayMode
  choices: Choice[]
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
  const t = useTranslations()

  return (
    <div
      className={twMerge(
        'gap-3',
        displayMode === ElementDisplayMode.Grid
          ? 'grid grid-cols-2'
          : 'flex flex-col'
      )}
    >
      <div>
        {t.rich(`shared.${ElementType.Mc}.richtext`, {
          b: (text) => <span className="font-bold">{text}</span>,
        })}
      </div>
      {choices.map((choice) => {
        return (
          <div key={`mc-choice-${choice.ix}-${choice.value}`}>
            <Button
              fluid
              className={{
                root: twMerge(
                  'hover:bg-unset min-h-[2.5rem] border-slate-400',
                  !hideFeedbacks &&
                    feedbacks &&
                    feedbacks[choice.ix] &&
                    'rounded-b-none'
                ),
              }}
              onClick={() =>
                onChange({ ...value, [choice.ix]: !value?.[choice.ix] })
              }
              active={value?.[choice.ix]}
              data={{
                cy: `mc-${elementIx + 1}-answer-option-${choice.ix + 1}`,
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
            {!hideFeedbacks && feedbacks && feedbacks[choice.ix] && (
              <ChoiceFeedback feedback={feedbacks[choice.ix]!} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default MCAnswerOptions
