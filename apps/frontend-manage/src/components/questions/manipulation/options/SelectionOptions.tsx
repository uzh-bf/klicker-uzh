import { useQuery } from '@apollo/client'
import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import { GetAnswerCollectionsElementsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  FormikNumberField,
  FormikSelectField,
  FormLabel,
  UserNotification,
} from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Dispatch, SetStateAction } from 'react'
import Select from 'react-select'
import { twMerge } from 'tailwind-merge'
import { ElementFormTypesSelection } from '../types'
import useAnswerCollectionChangeEffect from './useAnswerCollectionChangeEffect'
import useSelectAnswerCollectionOptions from './useSelectAnswerCollectionOptions'
import useSelectedAnswerEntry from './useSelectedAnswerEntry'

interface SelectionOptionsProps {
  templateId?: string
  isTemplate: boolean
  inputsDisabled?: boolean
  values: ElementFormTypesSelection
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
}

function SelectionOptions({
  templateId,
  isTemplate,
  inputsDisabled,
  values,
  setAnswerCollectionEntries,
}: SelectionOptionsProps) {
  const t = useTranslations()
  const [field, _, helpers] = useField<number[]>('options.correctAnswers')
  const { data, loading, refetch } = useQuery(
    GetAnswerCollectionsElementsDocument,
    {
      variables: { templateId },
      fetchPolicy: 'network-only',
    }
  )
  const collections = data?.getAnswerCollectionsElements ?? []

  // get all answer options from the selected collections
  const collectionAnswers = useSelectAnswerCollectionOptions({
    collectionId: values.options.answerCollection,
    collections,
    setAnswerCollectionEntries,
  })

  // filter the available answer options for the ones included in the current form state
  const selectedAnswers = useSelectedAnswerEntry({
    itemSelectionMode: 'existing',
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
        {t.rich('manage.elements.SEAnswerCollectionRequired', {
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
      <div className="flex flex-col gap-1 lg:flex-row lg:items-start lg:gap-4">
        <div className="flex flex-row items-end gap-1">
          <FormikSelectField
            required
            disabled={inputsDisabled}
            name="options.answerCollection"
            label={t('manage.elements.answerCollection')}
            labelType="small"
            tooltip={t('manage.elements.SELECTIONOptionsTooltip')}
            placeholder={t('manage.elements.selectCollection')}
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
            }}
          />
          <Button
            disabled={loading || inputsDisabled}
            onClick={async () => await refetch()}
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

        <FormikNumberField
          required
          disabled={inputsDisabled}
          min={1}
          name="options.numberOfInputs"
          label={t('manage.elements.numberOfInputs')}
          labelType="small"
          data={{ cy: 'configure-number-of-inputs' }}
          className={{
            field: 'w-40',
          }}
        />
      </div>
      {values.options.hasSampleSolution ? (
        <div>
          <FormLabel
            required
            label={t('manage.elements.correctAnswerOptions')}
            tooltip={t('manage.elements.correctAnswerOptionsTooltip')}
            labelType="small"
          />
          <div data-cy="choose-correct-answer-options">
            <Select
              isClearable
              isMulti
              isDisabled={inputsDisabled}
              value={selectedAnswers}
              options={collectionAnswers}
              menuPlacement="auto"
              classNames={{
                container: () => 'w-full',
              }}
              onChange={(newValue) =>
                helpers.setValue(newValue.map((tag) => tag.value))
              }
              placeholder={t('manage.elements.selectAnswerOptions')}
              noOptionsMessage={() =>
                t('manage.elements.noMatchingOptionFound')
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default SelectionOptions
