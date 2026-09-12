import type { SelectionElementOptions } from '@klicker-uzh/graphql/dist/ops'
import { FormLabel } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
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
    (selectedValue) =>
      selectedValue !== -1 &&
      selectedValue !== null &&
      typeof selectedValue !== 'undefined'
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
    <div className="text-base">
      <div className="mb-3">
        {t.rich('shared.questions.seSelectNCorrectOptions', {
          number: options.numberOfInputs ?? 1,
          b: (text) => <b>{text}</b>,
        })}
      </div>
      <div
        className={twMerge(
          'grid grid-cols-1 gap-y-2',
          !preview && 'md:grid-cols-2 md:gap-x-6'
        )}
      >
        {Object.entries(responses).map(([inputIndex, selectedValue], ix) => {
          const selectedLabel = options.answerCollection?.entries?.find(
            (entry) => entry.id === selectedValue
          )?.value

          return (
            <div
              key={`selection-element-${elementIx}-${inputIndex}-${selectedValue}`}
              className="flex flex-col"
            >
              <FormLabel
                required={ix === 0}
                label={t('shared.questions.seCorrectAnswerN', {
                  number: Number(inputIndex) + 1,
                })}
                labelType="small"
                className={{ label: 'h-7' }}
              />
              <Select
                isClearable
                id={`selection-${elementIx}-field-${Number(inputIndex)}`}
                instanceId={`selection-${elementIx}-field-${Number(inputIndex)}`}
                menuPlacement="top"
                isDisabled={disabled}
                value={
                  selectedValue !== -1 &&
                  typeof selectedValue !== 'undefined' &&
                  selectedValue !== null
                    ? { label: selectedLabel, value: selectedValue }
                    : undefined
                }
                options={selectionOptions}
                classNames={{
                  container: () => 'w-full',
                }}
                onChange={(newValue) => {
                  onChange({
                    ...responses,
                    [inputIndex]:
                      newValue?.value !== null &&
                      typeof newValue?.value !== 'undefined'
                        ? newValue.value
                        : -1,
                  })
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
