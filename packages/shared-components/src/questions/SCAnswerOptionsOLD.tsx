import { ElementDisplayMode } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface SCAnswerOptionsOLDProps {
  displayMode?: ElementDisplayMode
  choices: { value: string; correct: boolean; feedback: string }[]
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
      {choices.map((choice, index) => {
        return (
          <Button
            fluid
            className={{
              root: twMerge('hover:bg-unset min-h-[2.5rem] border-slate-400'),
            }}
            onClick={onChange(index)}
            key={`${choice.value}-${index}`}
            active={value?.includes(index)}
            data={{ cy: `sc-answer-option-${index}` }}
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
