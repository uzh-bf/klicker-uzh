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
import { useEffect, useMemo } from 'react'
import Select from 'react-select'
import { ElementFormTypesSelection } from '../types'

interface SelectionOptionsProps {
  values: ElementFormTypesSelection
}

function SelectionOptions({ values }: SelectionOptionsProps) {
  const t = useTranslations()
  const [field, _, helpers] = useField<number[]>('options.correctAnswers')
  const { data, loading } = useQuery(GetAnswerCollectionsDocument)

  // combine all collections that are accessible to the user
  const collections = useMemo(
    () => [
      ...(data?.getAnswerCollections?.answerCollections ?? []),
      ...(data?.getAnswerCollections?.sharedCollections ?? []),
    ],
    [
      data?.getAnswerCollections?.answerCollections,
      data?.getAnswerCollections?.sharedCollections,
    ]
  )

  // get all answer options from the selected collections
  const collectionAnswers = useMemo(() => {
    const selectedCollection = collections.find(
      (collection) =>
        collection.id === parseInt(values.options.answerCollection)
    )

    if (!selectedCollection || !selectedCollection.entries) {
      return []
    }

    return selectedCollection.entries.map((entry) => ({
      label: entry.value,
      value: entry.id,
      data: { cy: `select-answer-${entry.value}` },
    }))
  }, [collections, values.options.answerCollection])

  // filter the available answer options for the ones included in the current form state
  const selectedAnswers = useMemo(() => {
    if (!field.value) {
      return []
    }

    return collectionAnswers.filter((entry) =>
      field.value.includes(entry.value)
    )
  }, [collectionAnswers, field.value])

  // udpate the selected correct answers if the answer collection changes
  useEffect(() => {
    if (!field.value || !collectionAnswers || collectionAnswers.length === 0) {
      return
    }

    const newFieldValues = field.value.filter((id) =>
      collectionAnswers.map((entry) => entry.value).includes(id)
    )

    helpers.setValue(newFieldValues)
    // do not add value as a dependency --> rendering loo! - updates only on collection change desired
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionAnswers])

  if (loading) {
    return <Loader />
  }

  if (collections.length === 0) {
    return (
      <UserNotification
        type="warning"
        message={t('manage.questionForms.SEAnswerCollectionRequired')}
        className={{ root: 'text-base' }}
      />
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
