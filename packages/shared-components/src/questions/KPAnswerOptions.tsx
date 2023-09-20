import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  QuestionDisplayMode,
  QuestionType,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface KPAnswerOptionsProps {
  displayMode?: QuestionDisplayMode
  type: QuestionType
  choices: { value: string; correct: boolean; feedback: string }[]
  value?: { [key: number]: boolean }
  onChange: (answer: any, selectedValue: boolean) => any
  id?: string
}

export function KPAnswerOptions({
  displayMode,
  choices,
  value,
  onChange,
}: KPAnswerOptionsProps): React.ReactElement {
  return (
    <div
      className={twMerge(
        'gap-3',
        displayMode === QuestionDisplayMode.Grid
          ? 'grid grid-cols-2'
          : 'flex flex-col'
      )}
    >
      {choices.map((choice, index) => (
        <div
          className="flex flex-row items-center justify-between gap-4 p-2 border"
          data-cy="kp-answer-options"
        >
          <div>
            <Markdown
              withProse
              content={choice.value}
              className={{
                root: 'p-1 pt-2 prose-img:!m-0 max-w-none prose-p:!m-0',
              }}
            />
          </div>
          <div className="flex flex-row gap-2">
            <Button
              className={{
                root: twMerge(
                  'min-h-[2.5rem] border-slate-400 sm:hover:bg-unset'
                ),
              }}
              active={value?.[index] === true}
              onClick={onChange(index, true)}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faCheck} />
              </Button.Icon>
            </Button>
            <Button
              className={{
                root: twMerge(
                  'min-h-[2.5rem] border-slate-400 sm:hover:bg-unset'
                ),
              }}
              active={value?.[index] === false}
              onClick={onChange(index, false)}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faX} />
              </Button.Icon>
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default KPAnswerOptions
