import {
  FormikNumberField,
  FormLabel,
  UserNotification,
} from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import Select from 'react-select'
import Creatable from 'react-select/creatable'
import { ElementFormTypesSelection } from '../types'
import useSelectedAnswerEntry from './useSelectedAnswerEntry'
import useSelectionItemsChangeEffect from './useSelectionItemsChangeEffect'

interface SelectionManualItemCreationProps {
  inputsDisabled?: boolean
  values: ElementFormTypesSelection
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
  switchToCollectionSelection: () => void
}

function SelectionManualItemCreation({
  inputsDisabled,
  values,
  setAnswerCollectionEntries,
  switchToCollectionSelection,
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

  // make sure that only valid elements are stored as correct answers (-> on item removal, the item should also be removed from the correct answers)
  useSelectionItemsChangeEffect({
    items,
    solutions,
    solutionHelpers,
  })

  return (
    <div className="flex w-full flex-col">
      <UserNotification type="info">
        {t.rich('manage.elements.enterSelectionItemsManuallyExplanation', {
          b: (text) => <b>{text}</b>,
          button: (text) => (
            <span
              onClick={() => {
                // reset the selected items
                setAnswerCollectionEntries([])

                // switch to the selection mode for existing answer collections
                switchToCollectionSelection()
              }}
              className="cursor-pointer hover:underline"
              data-cy="switch-to-existing-collection-selection"
            >
              {text}
            </span>
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
        classNames={{ container: () => 'w-full' }}
        onChange={(newValue) => {
          // set the new collection items
          const prevItems = items.value ?? []
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
        placeholder={t('manage.elements.selectCaseStudyItems')}
        noOptionsMessage={() => t('manage.elements.noMatchingOptionFound')}
      />

      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end">
        <FormikNumberField
          required
          disabled={inputsDisabled}
          min={1}
          name="options.numberOfInputs"
          label={t('manage.elements.numberOfInputs')}
          labelType="small"
          data={{ cy: 'configure-number-of-inputs' }}
          className={{ field: 'mt-3 w-40' }}
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
                placeholder={t('manage.elements.selectAnswerOptions')}
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
