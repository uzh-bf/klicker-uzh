import type { SelectionQuestionOptions } from '@klicker-uzh/graphql/dist/ops'
import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface SELECTIONAnswerOptionsProps {
  responses: Record<number, number | undefined>
  onChange: (newValue: Record<number, number | undefined>) => void
  options: SelectionQuestionOptions
  elementIx: number
  disabled: boolean
  preview: boolean
}

function SELECTIONAnswerOptions({
  responses,
  onChange,
  options,
  elementIx,
  disabled,
  preview,
}: SELECTIONAnswerOptionsProps) {
  const t = useTranslations()

  // get the selected options, which are not undefined
  const selectedValues = Object.values(responses).filter(
    (selectedValue) => selectedValue !== undefined
  )

  return (
    <div>
      <div className="mb-3">
        {t.rich('shared.questions.seSelectNCorrectOptions', {
          number: options.numberOfInputs,
          b: (text) => <b>{text}</b>,
        })}
      </div>
      <div
        className={twMerge(
          'grid grid-cols-1 gap-y-2',
          !preview && 'md:grid-cols-2 md:gap-x-6 lg:grid-cols-3'
        )}
      >
        {Object.entries(responses).map(([inputIndex, selectedValue]) => {
          return (
            <div key={inputIndex} className="flex flex-col">
              <SelectField
                required
                value={selectedValue ? String(selectedValue) : undefined}
                onChange={(newValue) => {
                  onChange({ ...responses, [inputIndex]: parseInt(newValue) })
                }}
                items={
                  options.answerCollection?.entries?.map((entry) => ({
                    label: entry.value,
                    value: String(entry.id),
                    data: { cy: `select-answer-${entry.value}` },
                    disabled:
                      selectedValues.includes(entry.id) &&
                      selectedValue !== entry.id,
                  })) ?? []
                }
                label={t('shared.questions.seCorrectAnswerN', {
                  number: Number(inputIndex) + 1,
                })}
                labelType="small"
                placeholder={t('shared.questions.seSelectOption')}
                disabled={disabled}
                data={{
                  cy: `selection-${elementIx + 1}-field-${Number(inputIndex) + 1}`,
                }}
                className={{
                  root: 'w-full',
                  select: { root: 'w-full', trigger: 'w-full' },
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SELECTIONAnswerOptions
