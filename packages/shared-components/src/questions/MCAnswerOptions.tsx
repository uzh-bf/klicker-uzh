import { Choice, ElementDisplayMode } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface MCAnswerOptionsProps {
  displayMode?: ElementDisplayMode
  choices: Partial<Choice>[]
  value?: Record<number, boolean>
  onChange: (value: Record<number, boolean>) => void
  id?: string
  elementIx: number
  disabled: boolean
}

export function MCAnswerOptions({
  displayMode,
  choices,
  value,
  onChange,
  elementIx,
  disabled,
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
          <Button
            fluid
            className={{
              root: twMerge(
                'min-h-[2.5rem] border-slate-400 sm:hover:bg-unset'
              ),
            }}
            onClick={() => onChange({ ...value, [index]: !value?.[index] })}
            key={`${choice.value}-${index}`}
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
        )
      })}
    </div>
  )
}

export default MCAnswerOptions
