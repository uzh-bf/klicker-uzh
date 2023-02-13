import Markdown from '@klicker-uzh/markdown'
import { Button, ThemeContext } from '@uzh-bf/design-system'
import Image from 'next/image'
import React, { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

export interface SCAnswerOptionsProps {
  choices: { value: string; correct: boolean; feedback: string }[]
  value?: number[]
  onChange: (value: any) => any
  id?: string
}

export function SCAnswerOptions({
  choices,
  value,
  onChange,
}: SCAnswerOptionsProps): React.ReactElement {
  const theme = useContext(ThemeContext)

  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice, index) => {
        return (
          <Button
            fluid
            className={{
              root: twMerge('min-h-[2.5rem]'),
            }}
            onClick={onChange(index)}
            key={choice.value}
            active={value?.includes(index)}
            data={{ cy: 'sc-answer-options' }}
          >
            <Button.Label>
              <Markdown
                content={choice.value}
                components={{
                  img: ({ src, alt }: any) => (
                    <Image src={src} alt="Image" width={150} height={150} />
                  ),
                }}
                className="p-2 prose prose-img:m-0 max-w-none prose-p:m-0"
              />
            </Button.Label>
          </Button>
        )
      })}
    </div>
  )
}

export default SCAnswerOptions
