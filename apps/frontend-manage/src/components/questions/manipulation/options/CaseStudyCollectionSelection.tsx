import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import {
  FormikSelectField,
  FormikSwitchField,
  FormLabel,
} from '@uzh-bf/design-system'
import { FieldHelperProps } from 'formik'
import { useTranslations } from 'next-intl'
import Select from 'react-select'

function CaseStudyCollectionSelection({
  collections,
  selectedAnswers,
  collectionAnswers,
  helpers,
}: {
  collections: AnswerCollection[]
  selectedAnswers: { label: string; value: number }[]
  collectionAnswers: {
    label: string
    value: number
    data: {
      cy: string
    }
  }[]
  helpers: FieldHelperProps<number[]>
}) {
  const t = useTranslations()

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
              helpers.setValue(newValue.map((tag) => tag.value))
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
