import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormLabel,
  SelectField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Dispatch, SetStateAction, useState } from 'react'
import Select from 'react-select'
import { twMerge } from 'tailwind-merge'
import { ElementFormTypesCaseStudy } from '../types'
import CaseStudyCollectionChangeModal from './CaseStudyCollectionChangeModal'
import useAnswerCollectionChangeEffect from './useAnswerCollectionChangeEffect'
import useSelectAnswerCollectionOptions from './useSelectAnswerCollectionOptions'
import useSelectedAnswerEntry from './useSelectedAnswerEntry'

function CaseStudyCollectionSelection({
  loading,
  disabled,
  creationMode,
  isTemplate,
  collections,
  setSelectedItems,
  hasSampleSolution,
  setAnswerCollectionEntries,
  setItemSelectionMode,
  refetchAnswerCollections,
}: {
  loading: boolean
  disabled: boolean
  creationMode: boolean
  isTemplate: boolean
  collections: Pick<AnswerCollection, 'id' | 'name' | 'entries'>[]
  setSelectedItems: Dispatch<SetStateAction<{ id: number; name: string }[]>>
  hasSampleSolution: boolean
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
  setItemSelectionMode: (newValue: 'existing' | 'new') => void
  refetchAnswerCollections: () => Promise<any>
}) {
  const t = useTranslations()
  const [changeModalOpen, setChangeModalOpen] = useState(false)
  const [newValue, setNewValue] = useState<string>('')

  const [itemsField, _, itemsHelpers] = useField<
    ElementFormTypesCaseStudy['options']['selectedItems']
  >('options.selectedItems')
  const [collectionField, __, collectionHelpers] = useField<
    ElementFormTypesCaseStudy['options']['answerCollection']
  >('options.answerCollection')
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
    itemSelectionMode: 'existing',
    setSelectedItems,
  })

  // update the selected correct answers if the answer collection changes
  useAnswerCollectionChangeEffect({
    field: itemsField,
    helpers: itemsHelpers,
    collectionAnswers,
  })

  if (collections.length === 0) {
    return (
      <UserNotification type="warning" className={{ root: 'text-sm' }}>
        {t.rich('manage.elements.CSAnswerCollectionRequired', {
          link: (text) => (
            <span
              className="cursor-pointer font-bold underline"
              onClick={() => {
                // switch to the creation mode for new answer collection options
                setItemSelectionMode('new')

                // reset the selected items
                itemsHelpers.setValue([])
              }}
              data-cy="create-inline-answer-collection"
            >
              {text}
            </span>
          ),
          link2: (text) => (
            <Link
              href="/resources/answerCollections"
              className="font-bold underline"
            >
              {text}
            </Link>
          ),
          link3: (text) => (
            <Link href="/resources/catalog" className="font-bold underline">
              {text}
            </Link>
          ),
        })}
      </UserNotification>
    )
  }

  return (
    <>
      <div
        className={twMerge(
          'flex flex-row items-end gap-2',
          creationMode && '-mb-1.5'
        )}
      >
        <SelectField
          required
          disabled={disabled || loading}
          value={collectionField.value}
          onChange={(value) => {
            if (hasSampleSolution && selectedAnswers.length > 0) {
              setNewValue(value)
              setChangeModalOpen(true)
            } else {
              // set the selected answer collection to the new value
              collectionHelpers.setValue(value)

              // reset the selected items (resetting solutions is not required, since sample solution is disabled)
              itemsHelpers.setValue([])
            }
          }}
          label={t('manage.elements.answerCollection')}
          labelType="small"
          tooltip={t('manage.elements.caseStudyAnswerCollectionTooltip')}
          placeholder={t('manage.elements.selectCollection')}
          items={collections.map((collection) => ({
            label: collection.name,
            value: String(collection.id),
            data: {
              cy: `select-answer-collection-${collection.name}`,
            },
          }))}
          data={{ cy: 'select-answer-collection' }}
          className={{ select: { trigger: 'h-9 w-80' } }}
        />
        <Button
          disabled={disabled || loading}
          onClick={async () => await refetchAnswerCollections()}
          className={{ root: 'h-9 w-9' }}
          data={{ cy: 'refresh-answer-collections' }}
        >
          <Button.Icon
            withoutLabel
            icon={faArrowsRotate}
            className={{ root: twMerge(loading ? 'animate-spin' : '') }}
          />
        </Button>
      </div>
      {creationMode && (
        <Button
          basic
          onClick={() => {
            // reset the selected items tracked outside the form state
            setAnswerCollectionEntries([])
            setSelectedItems([])

            // reset the selected items
            itemsHelpers.setValue([])

            // manually reset the sample solutions defined for the created cases
            const newCases = casesField.value?.map((caseItem) => ({
              ...caseItem,
              solutions: undefined,
            }))
            casesHelpers.setValue(newCases)

            // reset the selected answer collection
            collectionHelpers.setValue(undefined)

            // switch to the creation mode for new answer collection options
            setItemSelectionMode('new')
          }}
          className={{
            root: 'text-primary-100 hover:text-primary-100 w-max px-0.5 py-1 text-sm hover:bg-transparent hover:underline',
          }}
          data={{ cy: `create-inline-answer-collection` }}
        >
          {t('manage.elements.enterItemsManually')}
        </Button>
      )}
      <div>
        <FormLabel
          required
          label={t('shared.generic.caseStudyItems')}
          tooltip={t('manage.elements.caseStudyItemsTooltip')}
          labelType="small"
        />
        <div data-cy="choose-case-study-items">
          <Select
            isClearable
            isMulti
            isDisabled={disabled || loading}
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
              if (newItemIds.length < (prevItemIds ?? []).length) {
                // identify the removed item
                const removedItem = (prevItemIds ?? []).find(
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
            placeholder={t('manage.elements.selectCaseStudyItems')}
            noOptionsMessage={() => t('manage.elements.noMatchingOptionFound')}
          />
        </div>
        <CaseStudyCollectionChangeModal
          open={changeModalOpen}
          onClose={() => {
            setNewValue('')
            setChangeModalOpen(false)
          }}
          onConfirm={() => {
            // set the selected answer collection to the new value
            collectionHelpers.setValue(newValue)

            // reset the selected items
            itemsHelpers.setValue([])

            // reset all solutions inside the cases
            casesHelpers.setValue(
              casesField.value?.map((caseItem) => {
                if ('solutions' in caseItem) {
                  return {
                    ...caseItem,
                    solutions: undefined,
                  }
                }

                return caseItem
              })
            )
          }}
        />
      </div>
    </>
  )
}

export default CaseStudyCollectionSelection
