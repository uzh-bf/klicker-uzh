import type { SelectionElementOptions } from '@klicker-uzh/graphql/dist/ops'
import { FormLabel } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useMemo } from 'react'
import Select from 'react-select'
import { twMerge } from 'tailwind-merge'
import type { SelectionStudentResponseType } from '../StudentElement'

interface SELECTIONAnswerOptionsProps {
  responses: SelectionStudentResponseType
  onChange: (newValue: SelectionStudentResponseType) => void
  options: SelectionElementOptions
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

  // get the selected options, which are not unselected
  const selectedValues = Object.values(responses).filter(
    (selectedValue) => selectedValue !== -1
  )

  // compute selection options for the select field
  const selectionOptions = useMemo(() => {
    if (
      !options.answerCollection?.entries ||
      options.answerCollection.entries.length === 0
    ) {
      return []
    }

    return (
      options.answerCollection?.entries
        ?.filter((entry) => !selectedValues.includes(entry.id))
        .map((entry) => ({
          label: entry.value,
          value: entry.id,
          data: { cy: `select-answer-${entry.value}` },
        })) ?? []
    )
  }, [options.answerCollection?.entries, selectedValues])

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
          const selectedLabel = options.answerCollection?.entries?.find(
            (entry) => entry.id === selectedValue
          )?.value

          return (
            <div key={inputIndex} className="flex flex-col">
              <FormLabel
                required
                label={t('shared.questions.seCorrectAnswerN', {
                  number: Number(inputIndex) + 1,
                })}
                labelType="small"
              />
              <Select
                id={`selection-${elementIx + 1}-field-${Number(inputIndex) + 1}`}
                instanceId={`selection-${elementIx + 1}-field-${Number(inputIndex) + 1}`}
                isDisabled={disabled}
                value={
                  typeof selectedValue !== 'undefined' && selectedValue !== -1
                    ? { label: selectedLabel, value: selectedValue }
                    : undefined
                }
                options={selectionOptions}
                classNames={{
                  container: () => 'w-full',
                }}
                onChange={(newValue) => {
                  onChange({ ...responses, [inputIndex]: newValue?.value })
                }}
                placeholder={t('shared.questions.seSelectOption')}
                noOptionsMessage={() =>
                  t('shared.questions.noMatchingOptionFound')
                }
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SELECTIONAnswerOptions
