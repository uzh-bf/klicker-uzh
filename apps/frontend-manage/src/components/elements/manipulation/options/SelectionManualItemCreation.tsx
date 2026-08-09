import {
  Button,
  FormikNumberField,
  FormLabel,
  UserNotification,
} from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useEffect } from 'react'
import Select from 'react-select'
import Creatable from 'react-select/creatable'
import { ElementFormTypesSelection } from '../types'
import useSelectedAnswerEntry from './useSelectedAnswerEntry'

interface SelectionManualItemCreationProps {
  inputsDisabled?: boolean
  values: ElementFormTypesSelection
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
  setItemSelectionMode: (newValue: 'existing' | 'new') => void
}

function SelectionManualItemCreation({
  inputsDisabled,
  values,
  setAnswerCollectionEntries,
  setItemSelectionMode,
}: SelectionManualItemCreationProps) {
  const t = useTranslations()
  const [items, _, itemHelpers] = useField<
    ElementFormTypesSelection['options']['manuallyCreatedItems']
  >('options.manuallyCreatedItems')
  const [solutions, __, solutionHelpers] = useField<
    ElementFormTypesSelection['options']['correctAnswers']
  >('options.correctAnswers')

  // filter the available answer options for the ones included in the current form state
  const selectedAnswers = useSelectedAnswerEntry({
    itemSelectionMode: 'existing',
    field: solutions,
    collectionAnswers:
      items.value?.map((item) => ({
        label: item.value,
        value: item.id,
      })) ?? [],
  })

  // Make sure that only valid elements are stored as correct answers (on item
  // removal, the item should also be removed from the correct answers).
  // biome-ignore lint/correctness/useExhaustiveDependencies: solution values are intentionally excluded to avoid a Formik update loop
  useEffect(() => {
    // if no items are available, reset the solution field
    if (!solutions.value || !items.value || items.value.length === 0) {
      if (solutions.value?.length) {
        solutionHelpers.setValue([])
      }
      return
    }

    const newFieldValues = solutions.value.filter((id) =>
      items.value!.map((item) => item.id).includes(id)
    )

    // if the existing solutions and the new ones are not the same, update the solutions field
    if (
      solutions.value.length !== newFieldValues.length ||
      solutions.value.some((id) => !newFieldValues.includes(id))
    ) {
      solutionHelpers.setValue(newFieldValues)
    }
  }, [items.value])

  return (
    <div className="flex w-full flex-col">
      <UserNotification type="info">
        {t.rich('manage.elements.enterSelectionItemsManuallyExplanation', {
          b: (text) => <b>{text}</b>,
          button: (text) => (
            <button
              type="button"
              onClick={() => {
                // reset the selected items
                setAnswerCollectionEntries([])

                // switch to the selection mode for existing answer collections
                setItemSelectionMode('existing')
              }}
              className="cursor-pointer border-0 bg-transparent p-0 hover:underline"
              data-cy="switch-to-existing-collection-selection"
            >
              {text}
            </button>
          ),
        })}
      </UserNotification>

      <FormLabel
        required
        label={t('manage.elements.selectionItems')}
        tooltip={t('manage.elements.newSelectionItemsTooltip')}
        labelType="small"
        className={{ label: 'mt-4' }}
      />
      <Creatable
        isClearable
        isMulti
        id="inline-answer-collection-options"
        isDisabled={inputsDisabled}
        value={
          items.value?.map((item) => ({
            label: item.value,
            value: item.id,
          })) ?? []
        }
        options={
          items.value?.map((item) => ({
            label: item.value,
            value: item.id,
          })) ?? []
        }
        classNames={{ container: () => 'w-full', menu: () => 'hidden' }}
        onChange={(newValue) => {
          // set the new collection items
          const newItems = newValue.map((item) => ({
            id: item.value,
            value: item.label.trim(),
          }))
          itemHelpers.setValue(newItems)

          // update the answer collection state for correct validation
          setAnswerCollectionEntries(
            newItems.map((item) => ({
              id: item.id,
              value: item.value,
            }))
          )
        }}
        onCreateOption={(newValue) => {
          // add the new tag to the list of new collection items, if it does not exist already
          if (
            !items.value?.some(
              (existingItem) => existingItem.value === newValue.trim()
            ) &&
            newValue.trim() !== ''
          ) {
            itemHelpers.setValue([
              ...(items.value ?? []),
              {
                id: Math.floor(Math.random() * 1000000 + 1),
                value: newValue.trim(),
              },
            ])

            // update the answer collection state for correct validation
            setAnswerCollectionEntries((prev) => [
              ...prev,
              { id: prev.length, value: newValue.trim() },
            ])
          }
        }}
        placeholder={t('manage.elements.insertNewItems')}
        noOptionsMessage={() => t('manage.elements.noMatchingOptionFound')}
      />
      <Button
        basic
        onClick={() => {
          // reset the selected items
          setAnswerCollectionEntries([])

          // switch to the selection mode for existing answer collections
          setItemSelectionMode('existing')
        }}
        className={{
          root: 'text-primary-100 hover:text-primary-100 w-max px-0.5 py-1 text-sm hover:bg-transparent hover:underline',
        }}
        data={{ cy: `switch-to-existing-collection-selection` }}
      >
        {t('manage.elements.returnSelectionItemsCollection')}
      </Button>

      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end">
        <FormikNumberField
          required
          disabled={inputsDisabled}
          min={1}
          name="options.numberOfInputs"
          label={t('manage.elements.numberOfInputs')}
          labelType="small"
          data={{ cy: 'configure-number-of-inputs' }}
          className={{ field: 'mt-1 w-40' }}
        />

        {values.options.hasSampleSolution ? (
          <div className="min-w-full lg:min-w-[calc(100%-11.5rem)]">
            <FormLabel
              required
              label={t('manage.elements.correctAnswerOptions')}
              tooltip={t('manage.elements.correctAnswerOptionsTooltip')}
              labelType="small"
              className={{ label: 'w-full' }}
            />
            <div data-cy="choose-correct-answer-options" className="w-full">
              <Select
                isClearable
                isMulti
                isDisabled={inputsDisabled}
                value={selectedAnswers}
                options={
                  items.value?.map((item) => ({
                    label: item.value,
                    value: item.id,
                  })) ?? []
                }
                menuPlacement="auto"
                classNames={{ container: () => 'w-full' }}
                onChange={(newValue) =>
                  solutionHelpers.setValue(newValue.map((tag) => tag.value))
                }
                placeholder={t('manage.elements.selectCorrectAnswerOptions')}
                noOptionsMessage={() =>
                  t('manage.elements.noMatchingOptionFound')
                }
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default SelectionManualItemCreation
