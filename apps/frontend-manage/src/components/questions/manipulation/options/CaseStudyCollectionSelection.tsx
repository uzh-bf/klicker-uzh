import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import { FormLabel, SelectField } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import Select from 'react-select'
import { ElementFormTypesCaseStudy } from '../types'
import CaseStudyCollectionChangeModal from './CaseStudyCollectionChangeModal'
import useAnswerCollectionChangeEffect from './useAnswerCollectionChangeEffect'
import useSelectAnswerCollectionOptions from './useSelectAnswerCollectionOptions'
import useSelectedAnswerEntry from './useSelectedAnswerEntry'

function CaseStudyCollectionSelection({
  isTemplate,
  collections,
  setSelectedItems,
  hasSampleSolution,
  setAnswerCollectionEntries,
}: {
  isTemplate: boolean
  collections: Pick<AnswerCollection, 'id' | 'name' | 'entries'>[]
  setSelectedItems: Dispatch<SetStateAction<{ id: number; name: string }[]>>
  hasSampleSolution: boolean
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
}) {
  const t = useTranslations()
  const [changeModalOpen, setChangeModalOpen] = useState(false)
  const [newValue, setNewValue] = useState<string>('')

  const [itemsField, _, itemsHelpers] = useField<number[]>(
    'options.selectedItems'
  )
  const [collectionField, __, collectionHelpers] = useField<string>(
    'options.answerCollection'
  )
  const [casesField, ___, casesHelpers] =
    useField<ElementFormTypesCaseStudy['options']['cases']>('options.cases')

  // get all answer options from the selected collections
  const collectionAnswers = useSelectAnswerCollectionOptions({
    collectionId: collectionField.value,
    collections,
    setAnswerCollectionEntries,
  })

  // filter the available answer options for the ones included in the current form state
  const selectedAnswers = useSelectedAnswerEntry({
    field: itemsField,
    collectionAnswers,
    setSelectedItems,
  })

  // udpate the selected correct answers if the answer collection changes
  useAnswerCollectionChangeEffect({
    field: itemsField,
    helpers: itemsHelpers,
    collectionAnswers,
  })

  return (
    <>
      <div className="flex flex-col justify-between gap-1 lg:flex-row lg:items-start lg:gap-3">
        <SelectField
          required
          value={collectionField.value}
          onChange={(value) => {
            if (hasSampleSolution && selectedAnswers.length > 0) {
              setNewValue(value)
              setChangeModalOpen(true)
            } else {
              collectionHelpers.setValue(value)
              itemsHelpers.setValue([])
            }
          }}
          label={t('manage.questionForms.answerCollection')}
          labelType="small"
          tooltip={t('manage.questionForms.caseStudyAnswerCollectionTooltip')}
          placeholder={t('manage.questionForms.selectCollection')}
          items={collections.map((collection) => ({
            label: collection.name,
            value: String(collection.id),
            data: {
              cy: `select-answer-collection-${collection.name}`,
            },
          }))}
          data={{ cy: 'select-answer-collection' }}
          className={{
            select: { trigger: 'h-9 w-80' },
            root: 'order-2 lg:order-1',
          }}
        />
      </div>
      <div>
        <FormLabel
          required
          label={t('shared.generic.caseStudyItems')}
          tooltip={t('manage.questionForms.caseStudyItemsTooltip')}
          labelType="small"
        />
        <div data-cy="choose-case-study-items">
          <Select
            isClearable
            isMulti
            value={selectedAnswers}
            options={collectionAnswers}
            menuPlacement="auto"
            classNames={{
              container: () => 'w-full',
            }}
            onChange={(newValue) => {
              const prevItemIds = itemsField.value
              const newItemIds = newValue.map((item) => item.value)

              // check if an item has been removed and conditionally remove the solutions for this item
              if (newItemIds.length < prevItemIds.length) {
                // identify the removed item
                const removedItem = prevItemIds.find(
                  (itemId) => !newItemIds.includes(itemId)
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
                          itemIdString !== `itemId-${removedItem}`
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

              // update the selected items
              itemsHelpers.setValue(newItemIds)
            }}
            placeholder={t('manage.questionForms.selectCaseStudyItems')}
            noOptionsMessage={() =>
              t('manage.questionForms.noMatchingOptionFound')
            }
          />
        </div>
        <CaseStudyCollectionChangeModal
          open={changeModalOpen}
          onClose={() => {
            setNewValue('')
            setChangeModalOpen(false)
          }}
          onConfirm={() => {
            collectionHelpers.setValue(newValue)
            itemsHelpers.setValue([])
          }}
        />
      </div>
    </>
  )
}

export default CaseStudyCollectionSelection
