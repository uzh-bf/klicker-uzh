import Markdown from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import React from 'react'

export interface SCAnswerOptionsProps {
  choices: { value: string; correct: boolean; feedback: string }[]
  value?: number[]
  onChange: (value: any) => any
}

export function SCAnswerOptions({
  choices,
  value,
  onChange,
}: SCAnswerOptionsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice, index) => {
        return (
          <Button
            fluid
            className={{
              root: 'border border-solid min-h-[2.5rem] border-uzh-blue-80',
            }}
            onClick={onChange(index)}
            key={choice.value}
            active={value?.includes(index)}
          >
            <Button.Label>
              <Markdown content={choice.value} />
            </Button.Label>
          </Button>
        )
      })}
    </div>
  )
}

export default SCAnswerOptions
