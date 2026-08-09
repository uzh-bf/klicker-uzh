import { Button, FormLabel, UserNotification } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import Creatable from 'react-select/creatable'
import { ElementFormTypesCaseStudy } from '../types'
import useSelectedNewItems from './useSelectedNewItems'

function CaseStudyManualItemCreation({
  disabled,
  itemSelectionMode,
  setItemSelectionMode,
  setAnswerCollectionEntries,
  setSelectedItems,
}: {
  disabled: boolean
  itemSelectionMode: 'existing' | 'new'
  setItemSelectionMode: (newValue: 'existing' | 'new') => void
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
  setSelectedItems: Dispatch<SetStateAction<{ id: number; name: string }[]>>
}) {
  const t = useTranslations()
  const [manualItemsField, ____, manualItemsHelpers] = useField<
    ElementFormTypesCaseStudy['options']['manuallyCreatedItems']
  >('options.manuallyCreatedItems')
  const [casesField, ___, casesHelpers] =
    useField<ElementFormTypesCaseStudy['options']['cases']>('options.cases')

  // update the selected items state whenever the manually created items change
  useSelectedNewItems({
    createdItems: manualItemsField.value ?? [],
    itemSelectionMode,
    setSelectedItems,
  })

  return (
    <div>
      <UserNotification type="info">
        {t.rich('manage.elements.enterItemsManuallyExplanation', {
          b: (text) => <b>{text}</b>,
          button: (text) => (
            <button
              type="button"
              onClick={() => {
                // reset the selected items tracked outside the form state
                setAnswerCollectionEntries([])
                setSelectedItems([])

                // reset the selected items
                manualItemsHelpers.setValue([])

                // manually reset the sample solutions defined for the created cases
                const newCases = casesField.value?.map((caseItem) => ({
                  ...caseItem,
                  solutions: undefined,
                }))
                casesHelpers.setValue(newCases)

                // switch to the selection mode for existing answer collections
                setItemSelectionMode('existing')
              }}
              className="text-primary-100 cursor-pointer border-0 bg-transparent p-0 underline"
            >
              {text}
            </button>
          ),
        })}
      </UserNotification>

      <FormLabel
        required
        label={t('shared.generic.caseStudyItems')}
        tooltip={t('manage.elements.newCaseStudyItemsTooltip')}
        labelType="small"
        className={{ label: 'mt-2' }}
      />
      <Creatable
        isClearable
        isMulti
        id="inline-answer-collection-options"
        isDisabled={disabled}
        value={
          manualItemsField.value?.map((item) => ({
            label: item.value,
            value: item.id,
          })) ?? []
        }
        options={
          manualItemsField.value?.map((item) => ({
            label: item.value,
            value: item.id,
          })) ?? []
        }
        classNames={{ container: () => 'w-full h-9', menu: () => 'hidden' }}
        onChange={(newValue) => {
          // set the new collection items
          const prevItems = manualItemsField.value ?? []
          const newItems = newValue.map((item) => ({
            id: item.value,
            value: item.label.trim(),
          }))
          manualItemsHelpers.setValue(newItems)

          // check if an item has been removed and conditionally remove the solutions for this item
          if (newItems.length < prevItems.length) {
            // identify the removed item
            const removedItem = prevItems.find(
              (prevItem) =>
                !newItems.map((item) => item.id).includes(prevItem.id)
            )

            // if an item has been removed, remove the corresponding key from the case solutions
            if (removedItem) {
              const newCases = casesField.value?.map((caseItem) => {
                // if no solutions are set, skip this case
                if (!('solutions' in caseItem) || !caseItem.solutions) {
                  return caseItem
                }

                // filter out all solution entries for the removed item
                const newSolutions = Object.fromEntries(
                  Object.entries(caseItem.solutions).filter(
                    ([itemIdString]) =>
                      itemIdString !== `itemId-${removedItem.id}`
                  )
                )

                return {
                  ...caseItem,
                  solutions: newSolutions,
                }
              })

              // update the cases field
              casesHelpers.setValue(newCases)
            }
          }

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
            !manualItemsField.value?.some(
              (existingItem) => existingItem.value === newValue.trim()
            ) &&
            newValue.trim() !== ''
          ) {
            manualItemsHelpers.setValue([
              ...(manualItemsField.value ?? []),
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
          // reset the selected items tracked outside of the form state
          setAnswerCollectionEntries([])
          setSelectedItems([])

          // reset the manually created items
          manualItemsHelpers.setValue([])

          // switch to the selection mode for existing answer collections
          setItemSelectionMode('existing')
        }}
        className={{
          root: 'text-primary-100 hover:text-primary-100 w-max px-0.5 pt-1.5 text-sm hover:bg-transparent hover:underline',
        }}
        data={{ cy: `switch-to-existing-collection-selection` }}
      >
        {t('manage.elements.returnItemsCollectionSelection')}
      </Button>
    </div>
  )
}

export default CaseStudyManualItemCreation
