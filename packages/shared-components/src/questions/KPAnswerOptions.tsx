import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Choice,
  ElementDisplayMode,
  ElementType,
  QuestionFeedback,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import ChoiceFeedback from '../evaluation/ChoiceFeedback'

export interface KPAnswerOptionsProps {
  displayMode?: ElementDisplayMode
  type: ElementType
  choices: Partial<Choice>[]
  feedbacks?: QuestionFeedback[] | null
  value?: Record<number, boolean>
  onChange: (newValue: Record<number, boolean>) => void
  id?: string
  elementIx: number
  disabled: boolean
  hideFeedbacks?: boolean
}

export function KPAnswerOptions({
  displayMode,
  choices,
  feedbacks,
  value,
  onChange,
  elementIx,
  disabled,
  hideFeedbacks = false,
}: KPAnswerOptionsProps): React.ReactElement {
  return (
    <div
      className={twMerge(
        'gap-3',
        displayMode === ElementDisplayMode.Grid
          ? 'grid grid-cols-2'
          : 'flex flex-col'
      )}
    >
      {choices.map((choice, index) => (
        <div key={`kp-choice-${index}-${choice.value}`}>
          <div
            className={twMerge(
              'flex flex-row items-center justify-between gap-4 p-2 border rounded',
              !hideFeedbacks &&
                feedbacks &&
                feedbacks[index] &&
                '!rounded-b-none'
            )}
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
                    'min-h-[2.5rem] border-slate-400 hover:bg-unset'
                  ),
                }}
                active={value?.[index] === true}
                onClick={() => onChange({ ...value, [index]: true })}
                data={{
                  cy: `toggle-kp-${elementIx + 1}-answer-${index + 1}-correct`,
                }}
                disabled={disabled}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faCheck} />
                </Button.Icon>
              </Button>
              <Button
                className={{
                  root: twMerge(
                    'min-h-[2.5rem] border-slate-400 hover:bg-unset'
                  ),
                }}
                active={value?.[index] === false}
                onClick={() => onChange({ ...value, [index]: false })}
                data={{
                  cy: `toggle-kp-${elementIx + 1}-answer-${
                    index + 1
                  }-incorrect`,
                }}
                disabled={disabled}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faX} />
                </Button.Icon>
              </Button>
            </div>
          </div>
          {!hideFeedbacks && feedbacks && feedbacks[index] && (
            <ChoiceFeedback feedback={feedbacks[index]} />
          )}
        </div>
      ))}
    </div>
  )
}

export default KPAnswerOptions
