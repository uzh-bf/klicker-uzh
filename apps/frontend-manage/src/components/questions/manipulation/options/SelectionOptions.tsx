import { useQuery } from '@apollo/client'
import { GetAnswerCollectionsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  FormikNumberField,
  FormikSelectField,
  FormikSwitchField,
  FormLabel,
  UserNotification,
} from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Dispatch, SetStateAction } from 'react'
import Select from 'react-select'
import { ElementFormTypesSelection } from '../types'
import useAnswerCollectionChangeEffect from './useAnswerCollectionChangeEffect'
import useFormCollections from './useFormCollections'
import useSelectAnswerCollectionOptions from './useSelectAnswerCollectionOptions'
import useSelectedAnswerEntry from './useSelectedAnswerEntry'

interface SelectionOptionsProps {
  values: ElementFormTypesSelection
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
}

function SelectionOptions({
  values,
  setAnswerCollectionEntries,
}: SelectionOptionsProps) {
  const t = useTranslations()
  const [field, _, helpers] = useField<number[]>('options.correctAnswers')
  const { data, loading } = useQuery(GetAnswerCollectionsDocument)

  // combine all collections that are accessible to the user
  const collections = useFormCollections({
    dbCollections: data?.getAnswerCollections,
  })

  // get all answer options from the selected collections
  const collectionAnswers = useSelectAnswerCollectionOptions({
    collectionId: values.options.answerCollection,
    collections,
    setAnswerCollectionEntries,
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
      <UserNotification type="warning" className={{ root: 'text-base' }}>
        {t.rich('manage.questionForms.SEAnswerCollectionRequired', {
          link: (text) => (
            <Link
              href="/resources"
              className="text-primary-100 hover:underline"
            >
              {text}
            </Link>
          ),
        })}
      </UserNotification>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 lg:flex-row lg:items-start lg:gap-3">
        <FormikSelectField
          required
          name="options.answerCollection"
          label={t('manage.questionForms.answerCollection')}
          labelType="small"
          tooltip={t('manage.questionForms.SELECTIONOptionsTooltip')}
          placeholder={t('manage.questionForms.selectCollection')}
          items={collections.map((collection) => ({
            label: `${collection.name} (${collection.entries?.length ?? 0} ${t('shared.generic.entries')})`,
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
        <FormikNumberField
          required
          min={1}
          name="options.numberOfInputs"
          label={t('manage.questionForms.numberOfInputs')}
          labelType="small"
          data={{ cy: 'configure-number-of-inputs' }}
          className={{
            field: 'w-40',
            root: 'order-3 lg:order-2',
          }}
        />
        <FormikSwitchField
          name="options.hasSampleSolution"
          label={t('shared.generic.sampleSolution')}
          data={{ cy: 'configure-sample-solution' }}
          className={{
            label: 'text-gray-600',
            root: 'order-1 mt-2 self-end lg:order-3 lg:self-start',
          }}
        />
      </div>
      {values.options.hasSampleSolution ? (
        <div>
          <FormLabel
            required
            label={t('manage.questionForms.correctAnswerOptions')}
            tooltip={t('manage.questionForms.correctAnswerOptionsTooltip')}
            labelType="small"
          />
          <div data-cy="choose-correct-answer-options">
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
              placeholder={t('manage.questionForms.selectAnswerOptions')}
              noOptionsMessage={() =>
                t('manage.questionForms.noMatchingOptionFound')
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default SelectionOptions
