import type { SelectionQuestionOptions } from '@klicker-uzh/graphql/dist/ops'
import { SelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useMemo } from 'react'

interface SELECTIONAnswerOptionsProps {
  responses: Record<number, number | undefined>
  onChange: (newValue: Record<number, number | undefined>) => void
  options: SelectionQuestionOptions
  elementIx: number
  disabled: boolean
}

function SELECTIONAnswerOptions({
  responses,
  onChange,
  options,
  elementIx,
  disabled,
}: SELECTIONAnswerOptionsProps) {
  const t = useTranslations()

  // get the selected options, which are not undefined
  const selectedValues = Object.values(responses).filter(
    (selectedValue) => selectedValue !== undefined
  )

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      {Object.entries(responses).map(([inputIndex, selectedValue]) => {
        const selectItems = useMemo(() => {
          return options.answerCollection!.entries!.map((entry) => ({
            label: entry.value,
            value: String(entry.id),
            disabled:
              selectedValues.includes(entry.id) && selectedValue !== entry.id,
          }))
        }, [responses])

        return (
          <div key={inputIndex} className="flex flex-col">
            <SelectField
              required
              value={selectedValue ? String(selectedValue) : undefined}
              onChange={(newValue) => {
                onChange({ ...responses, [inputIndex]: parseInt(newValue) })
              }}
              items={selectItems}
              label={t('shared.questions.seCorrectAnswerN', {
                number: Number(inputIndex) + 1,
              })}
              labelType="small"
              placeholder={t('shared.questions.seSelectOption')}
              disabled={disabled}
              className={{
                root: 'w-full',
                select: { root: 'w-full', trigger: 'w-full' },
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

export default SELECTIONAnswerOptions
