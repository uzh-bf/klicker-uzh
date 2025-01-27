import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import {
  FormikSelectField,
  FormikSwitchField,
  FormLabel,
} from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import Select from 'react-select'
import useAnswerCollectionChangeEffect from './useAnswerCollectionChangeEffect'
import useSelectAnswerCollectionOptions from './useSelectAnswerCollectionOptions'
import useSelectedAnswerEntry from './useSelectedAnswerEntry'

function CaseStudyCollectionSelection({
  collections,
}: {
  collections: AnswerCollection[]
}) {
  const t = useTranslations()
  const [itemsField, _, itemsHelpers] = useField<number[]>(
    'options.selectedItems'
  )
  const [collectionField] = useField<string>('options.answerCollection')

  // get all answer options from the selected collections
  const collectionAnswers = useSelectAnswerCollectionOptions({
    collectionId: collectionField.value,
    collections,
  })

  // filter the available answer options for the ones included in the current form state
  const selectedAnswers = useSelectedAnswerEntry({
    field: itemsField,
    collectionAnswers,
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
        <FormikSelectField
          required
          name="options.answerCollection"
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
              // TODO: add confirmation step to changing this (if the previous value is not empty AND sample solution is activated -> all specified solution ranges will be lost!)
              itemsHelpers.setValue(newValue.map((tag) => tag.value))
            }
            placeholder={t('manage.questionForms.selectCaseStudyItems')}
            noOptionsMessage={() =>
              t('manage.questionForms.noMatchingOptionFound')
            }
          />
        </div>
      </div>
    </>
  )
}

export default CaseStudyCollectionSelection
