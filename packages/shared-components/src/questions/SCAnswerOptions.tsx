import { QuestionDisplayMode } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface SCAnswerOptionsProps {
  displayMode?: QuestionDisplayMode
  choices: { value: string; correct: boolean; feedback: string }[]
  value?: number[]
  onChange: (value: any) => any
  id?: string
}

export function SCAnswerOptions({
  displayMode,
  choices,
  value,
  onChange,
}: SCAnswerOptionsProps): React.ReactElement {
  return (
    <div
      className={twMerge(
        'gap-3',
        displayMode === QuestionDisplayMode.Grid
          ? 'grid grid-cols-2'
          : 'flex flex-col'
      )}
    >
      {choices.map((choice, index) => {
        return (
          <Button
            fluid
            className={{
              root: twMerge('min-h-[2.5rem] border-slate-400'),
            }}
            onClick={onChange(index)}
            key={choice.value}
            active={value?.includes(index)}
            data={{ cy: 'sc-answer-options' }}
          >
            <Button.Label>
              <Markdown
                content={choice.value}
                className="p-1 pt-2 prose prose-img:!m-0 max-w-none prose-p:!m-0"
              />
            </Button.Label>
          </Button>
        )
      })}
    </div>
  )
}

export default SCAnswerOptions
