import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementDisplayMode, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import type { Choice } from '@klicker-uzh/types'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface KPAnswerOptionsOLDProps {
  displayMode?: ElementDisplayMode
  type: ElementType
  choices: Choice[]
  value?: { [key: number]: boolean }
  onChange: (answer: any, selectedValue: boolean) => any
  id?: string
}

export function KPAnswerOptionsOLD({
  displayMode,
  choices,
  value,
  onChange,
}: KPAnswerOptionsOLDProps): React.ReactElement {
  return (
    <div
      className={twMerge(
        'gap-3',
        displayMode === ElementDisplayMode.Grid
          ? 'grid grid-cols-2'
          : 'flex flex-col'
      )}
    >
      {choices
        .sort((a, b) => (a.ix > b.ix ? 1 : -1))
        .map((choice) => (
          <div
            className="flex flex-row items-center justify-between gap-4 border p-2"
            data-cy="kp-answer-options"
          >
            <div>
              <Markdown
                withProse
                content={choice.value}
                className={{
                  root: 'prose-p:!m-0 prose-img:!m-0 max-w-none p-1 pt-2',
                }}
              />
            </div>
            <div className="flex flex-row gap-2">
              <Button
                className={{
                  root: twMerge(
                    'hover:bg-unset min-h-[2.5rem] border-slate-400'
                  ),
                }}
                active={value?.[choice.ix] === true}
                onClick={onChange(choice.ix, true)}
                data={{ cy: `toggle-kp-answer-${choice.ix}-correct` }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faCheck} />
                </Button.Icon>
              </Button>
              <Button
                className={{
                  root: twMerge(
                    'hover:bg-unset min-h-[2.5rem] border-slate-400'
                  ),
                }}
                active={value?.[choice.ix] === false}
                onClick={onChange(choice.ix, false)}
                data={{ cy: `toggle-kp-answer-${choice.ix}-incorrect` }}
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

export default KPAnswerOptionsOLD
