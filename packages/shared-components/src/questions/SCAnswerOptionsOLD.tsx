import { ElementDisplayMode } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import type { Choice } from '@klicker-uzh/types'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface SCAnswerOptionsOLDProps {
  displayMode?: ElementDisplayMode
  choices: Choice[]
  value?: number[]
  onChange: (value: any) => any
  id?: string
}

export function SCAnswerOptionsOLD({
  displayMode,
  choices,
  value,
  onChange,
}: SCAnswerOptionsOLDProps): React.ReactElement {
  return (
    <div
      className={twMerge(
        'gap-3',
        displayMode === ElementDisplayMode.Grid
          ? 'grid grid-cols-2'
          : 'flex flex-col'
      )}
    >
      {choices.map((choice) => {
        return (
          <Button
            fluid
            className={{
              root: twMerge('hover:bg-unset min-h-[2.5rem] border-slate-400'),
            }}
            onClick={onChange(choice.ix)}
            key={`${choice.value}-${choice.ix}`}
            active={value?.includes(choice.ix)}
            data={{ cy: `sc-answer-option-${choice.ix}` }}
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
        )
      })}
    </div>
  )
}

export default SCAnswerOptionsOLD
