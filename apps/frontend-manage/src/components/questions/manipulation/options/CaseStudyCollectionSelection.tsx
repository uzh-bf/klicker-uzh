import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import {
  FormikSwitchField,
  FormLabel,
  SelectField,
} from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import Select from 'react-select'
import CaseStudyCollectionChangeModal from './CaseStudyCollectionChangeModal'
import useAnswerCollectionChangeEffect from './useAnswerCollectionChangeEffect'
import useSelectAnswerCollectionOptions from './useSelectAnswerCollectionOptions'
import useSelectedAnswerEntry from './useSelectedAnswerEntry'

function CaseStudyCollectionSelection({
  collections,
  setSelectedItems,
  hasSampleSolution,
}: {
  collections: AnswerCollection[]
  setSelectedItems: Dispatch<SetStateAction<{ id: number; name: string }[]>>
  hasSampleSolution: boolean
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

  // get all answer options from the selected collections
  const collectionAnswers = useSelectAnswerCollectionOptions({
    collectionId: collectionField.value,
    collections,
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
        <FormikSwitchField
          name="options.hasSampleSolution"
          label={t('shared.generic.sampleSolution')}
          data={{ cy: 'configure-sample-solution' }}
          className={{
            label: 'text-gray-600',
            root: 'order-1 mt-2 self-end lg:order-2 lg:self-start',
          }}
        />
      </div>
      <div>
        <FormLabel
          required
          label={t('manage.questionForms.caseStudyItems')}
          tooltip={t('manage.questionForms.caseStudyItemsTooltip')}
          labelType="small"
        />
        <div data-cy="choose-case-study-items">
          <Select
            isClearable
            isMulti
            value={selectedAnswers}
            options={collectionAnswers}
            classNames={{
              container: () => 'w-full',
            }}
            onChange={(newValue) =>
              itemsHelpers.setValue(newValue.map((tag) => tag.value))
            }
            placeholder={t('manage.questionForms.selectCaseStudyItems')}
            noOptionsMessage={() =>
              t('manage.questionForms.noMatchingOptionFound')
            }
          />
        </div>
        <CaseStudyCollectionChangeModal
          open={changeModalOpen}
          onClose={() => setChangeModalOpen(false)}
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
