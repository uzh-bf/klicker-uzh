import { useQuery } from '@apollo/client'
import { GetAnswerCollectionsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  FormikSelectField,
  FormikSwitchField,
  FormLabel,
  UserNotification,
} from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import Select from 'react-select'
import { ElementFormTypesCaseStudy } from '../types'
import useAnswerCollectionChangeEffect from './useAnswerCollectionChangeEffect'
import useFormCollections from './useFormCollections'
import useSelectAnswerCollectionOptions from './useSelectAnswerCollectionOptions'
import useSelectedAnswerEntry from './useSelectedAnswerEntry'

interface CaseStudyOptionsProps {
  values: ElementFormTypesCaseStudy
}

function CaseStudyOptions({ values }: CaseStudyOptionsProps) {
  const t = useTranslations()
  const [field, _, helpers] = useField<number[]>('options.selectedItems')
  const { data, loading } = useQuery(GetAnswerCollectionsDocument)

  // combine all collections that are accessible to the user
  const collections = useFormCollections({
    dbCollections: data?.getAnswerCollections,
  })

  // get all answer options from the selected collections
  const collectionAnswers = useSelectAnswerCollectionOptions({
    collectionId: values.options.answerCollection,
    collections,
  })

  // filter the available answer options for the ones included in the current form state
  const selectedAnswers = useSelectedAnswerEntry({
    field,
    collectionAnswers,
  })

  // udpate the selected correct answers if the answer collection changes
  useAnswerCollectionChangeEffect({
    field,
    helpers,
    collectionAnswers,
  })

  if (loading) {
    return <Loader />
  }

  if (collections.length === 0) {
    return (
      <UserNotification
        type="warning"
        message={t('manage.questionForms.CSAnswerCollectionRequired')}
        className={{ root: 'text-base' }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
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
              helpers.setValue(newValue.map((tag) => tag.value))
            }
            placeholder={t('manage.questionForms.selectCaseStudyItems')}
            noOptionsMessage={() =>
              t('manage.questionForms.noMatchingOptionFound')
            }
          />
        </div>
      </div>
      <hr className="border-uzh-grey-40 my-2 w-full border-2" />
      <div>CRITERIA</div>
      <hr className="border-uzh-grey-40 my-2 w-full border-2" />
      <div>CASES /w CRITERIA SOLUTION RANGES IF DEFINED</div>
    </div>
  )
}

export default CaseStudyOptions
