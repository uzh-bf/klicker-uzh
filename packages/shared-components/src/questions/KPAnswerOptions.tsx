import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import type { Choice, QuestionFeedback } from '@klicker-uzh/graphql/dist/ops'
import { ElementDisplayMode, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import ChoiceFeedback from '../evaluation/ChoiceFeedback'
import type { ChoicesStudentResponseType } from '../StudentElement'

export interface KPAnswerOptionsProps {
  displayMode?: ElementDisplayMode
  type: ElementType
  choices: Choice[]
  feedbacks?: QuestionFeedback[] | null
  value?: ChoicesStudentResponseType
  onChange: (newValue: ChoicesStudentResponseType) => void
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
      {choices.map((choice) => (
        <div key={`kp-choice-${choice.ix}-${choice.value}`}>
          <div
            className={twMerge(
              'flex flex-row items-center justify-between gap-4 rounded border p-2',
              !hideFeedbacks &&
                feedbacks &&
                feedbacks[choice.ix] &&
                'rounded-b-none!'
            )}
            data-cy="kp-answer-options"
          >
            <div id={`kp-choice-${elementIx}-${choice.ix}-label`}>
              <Markdown
                withProse
                content={choice.value}
                className={{
                  root: 'prose-p:m-0! prose-img:m-0! max-w-none p-1 pt-2',
                }}
              />
            </div>
            <div className="flex flex-row gap-2">
              <Button
                className={{
                  root: twMerge(
                    'p-0! disabled:bg-accent disabled:hover:bg-accent h-9 w-9 border-slate-400 disabled:cursor-not-allowed disabled:opacity-90',
                    value?.[choice.ix] === true &&
                      'bg-primary-20 disabled:bg-primary-20 border-primary-100 hover:bg-primary-20 disabled:hover:bg-primary-20 disabled:cursor-not-allowed',
                    feedbacks?.[choice.ix]?.correct === true &&
                      'border-2 border-green-600',
                    feedbacks?.[choice.ix]?.correct === false &&
                      'border-2 border-red-600'
                  ),
                }}
                onClick={() => onChange({ ...value, [choice.ix]: true })}
                data={{
                  cy: `toggle-kp-${elementIx}-answer-${choice.ix}-correct`,
                }}
                aria-label={t('shared.generic.correct')}
                aria-describedby={`kp-choice-${elementIx}-${choice.ix}-label`}
                aria-pressed={value?.[choice.ix] === true}
                disabled={disabled}
              >
                <Button.Icon
                  withoutLabel
                  icon={faCheck}
                  className={{ root: 'h-[1.2rem] w-[1.2rem]' }}
                />
              </Button>
              <Button
                className={{
                  root: twMerge(
                    'disabled:bg-accent disabled:hover:bg-accent h-9 w-9 border-slate-400 disabled:cursor-not-allowed disabled:opacity-90',
                    value?.[choice.ix] === false &&
                      'bg-primary-20 disabled:bg-primary-20 border-primary-100 hover:bg-primary-20 disabled:hover:bg-primary-20 disabled:cursor-not-allowed',
                    feedbacks?.[choice.ix]?.correct === false &&
                      'border-2 border-green-600',
                    feedbacks?.[choice.ix]?.correct === true &&
                      'border-2 border-red-600'
                  ),
                }}
                onClick={() => onChange({ ...value, [choice.ix]: false })}
                data={{
                  cy: `toggle-kp-${elementIx}-answer-${choice.ix}-incorrect`,
                }}
                aria-label={t('shared.generic.incorrect')}
                aria-describedby={`kp-choice-${elementIx}-${choice.ix}-label`}
                aria-pressed={value?.[choice.ix] === false}
                disabled={disabled}
              >
                <Button.Icon
                  withoutLabel
                  icon={faX}
                  className={{ root: 'h-[1.2rem] w-[1.2rem]' }}
                />
              </Button>
            </div>
          </div>
          {!hideFeedbacks && feedbacks && feedbacks[choice.ix] && (
            <ChoiceFeedback
              elementIx={elementIx}
              choiceIx={choice.ix}
              feedback={feedbacks[choice.ix]!}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default KPAnswerOptions
