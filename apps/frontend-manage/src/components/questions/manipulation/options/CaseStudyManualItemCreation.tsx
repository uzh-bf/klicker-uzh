import { FormLabel, UserNotification } from '@uzh-bf/design-system'
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
            <span
              onClick={() => {
                // reset the selected items
                setAnswerCollectionEntries([])

                // switch to the selection mode for existing answer collections
                setItemSelectionMode('existing')
              }}
              className="cursor-pointer hover:underline"
            >
              {text}
            </span>
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
        classNames={{ container: () => 'w-full h-9' }}
        onChange={(newValue) => {
          // set the new collection items
          const prevItems = manualItemsField.value ?? []
          const newItems = newValue.map((item) => ({
            id: item.value,
            value: item.label,
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
              (existingItem) => existingItem.value === newValue
            )
          ) {
            manualItemsHelpers.setValue([
              ...(manualItemsField.value ?? []),
              { id: Math.floor(Math.random() * 1000000 + 1), value: newValue },
            ])

            // update the answer collection state for correct validation
            setAnswerCollectionEntries((prev) => [
              ...prev,
              { id: prev.length, value: newValue },
            ])
          }
        }}
        placeholder={t('manage.elements.selectCaseStudyItems')}
        noOptionsMessage={() => t('manage.elements.noMatchingOptionFound')}
      />
    </div>
  )
}

export default CaseStudyManualItemCreation
