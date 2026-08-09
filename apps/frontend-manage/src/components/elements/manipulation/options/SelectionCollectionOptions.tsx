import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
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
import { Dispatch, SetStateAction, useEffect, useMemo } from 'react'
import Select from 'react-select'
import { twMerge } from 'tailwind-merge'
import { ElementFormTypesSelection } from '../types'
import AnswerCollectionInlineEditButton from './AnswerCollectionInlineEditButton'
import useSelectAnswerCollectionOptions from './useSelectAnswerCollectionOptions'
import useSelectedAnswerEntry from './useSelectedAnswerEntry'

interface SelectionCollectionOptionsProps {
  creationMode: boolean
  inputsDisabled?: boolean
  loading: boolean
  values: ElementFormTypesSelection
  collections: Omit<AnswerCollection, 'description'>[]
  refetchCollections: () => Promise<any>
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
  setItemSelectionMode: (newValue: 'existing' | 'new') => void
  openAnswerCollectionEditModal: (collectionId: number) => void
}

function SelectionCollectionOptions({
  creationMode,
  inputsDisabled,
  loading,
  values,
  collections,
  refetchCollections,
  setAnswerCollectionEntries,
  setItemSelectionMode,
  openAnswerCollectionEditModal,
}: SelectionCollectionOptionsProps) {
  const t = useTranslations()
  const [solutions, _, solutionHelpers] = useField<
    ElementFormTypesSelection['options']['correctAnswers']
  >('options.correctAnswers')
  const [collectionField, ___, collectionHelpers] = useField<
    ElementFormTypesSelection['options']['answerCollection']
  >('options.answerCollection')

  // get all answer options from the selected collections
  const collectionAnswers = useSelectAnswerCollectionOptions({
    collectionId: values.options.answerCollection,
    collections,
    setAnswerCollectionEntries,
  })

  // filter the available answer options for the ones included in the current form state
  const selectedAnswers = useSelectedAnswerEntry({
    itemSelectionMode: 'existing',
    field: solutions,
    collectionAnswers,
  })

  // update the selected correct answers if the answer collection changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: solution values are intentionally excluded to avoid a Formik update loop
  useEffect(() => {
    // if no collection answers are available, reset the solutions field
    if (
      !solutions.value ||
      !collectionAnswers ||
      collectionAnswers.length === 0
    ) {
      if (solutions.value?.length) {
        solutionHelpers.setValue([])
      }
      return
    }

    const newFieldValues = solutions.value.filter((id) =>
      collectionAnswers.map((entry) => entry.value).includes(id)
    )

    // if the existing solutions and the new ones are not the same, update the solutions field
    if (
      solutions.value.length !== newFieldValues.length ||
      solutions.value.some((id) => !newFieldValues.includes(id))
    ) {
      solutionHelpers.setValue(newFieldValues)
    }
  }, [collectionAnswers])

  // locally store the selected answer collection
  const selectedCollection = useMemo(() => {
    if (typeof collectionField.value === 'undefined') {
      return undefined
    }

    return collections.find(
      (collection) => collection.id === parseInt(collectionField.value!)
    )
  }, [collectionField.value, collections])

  if (collections.length === 0) {
    return (
      <UserNotification type="warning" className={{ root: 'text-sm' }}>
        {t.rich('manage.elements.SEAnswerCollectionRequired', {
          link: (text) => (
            <button
              type="button"
              className="cursor-pointer font-bold underline"
              onClick={() => {
                // unsert any answer collection entries
                setAnswerCollectionEntries([])

                // reset the answer collection field to ensure that all fields update
                collectionHelpers.setValue(undefined)

                // switch to the creation mode for new answer collection options
                setItemSelectionMode('new')
              }}
              data-cy="create-inline-answer-collection"
            >
              {text}
            </button>
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
    <div className="flex flex-col gap-2">
      <div
        className={twMerge(
          'flex flex-col gap-1 lg:flex-row lg:items-start lg:gap-4',
          creationMode && '-mb-2'
        )}
      >
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
            onClick={async () => await refetchCollections()}
            className={{ root: 'h-9 w-9' }}
            data={{ cy: 'refresh-answer-collections' }}
          >
            <Button.Icon
              withoutLabel
              icon={faArrowsRotate}
              className={{ root: twMerge(loading ? 'animate-spin' : '') }}
            />
          </Button>
          <AnswerCollectionInlineEditButton
            disabled={!selectedCollection?.isEditor}
            selectedCollectionId={
              collectionField.value
                ? parseInt(collectionField.value)
                : undefined
            }
            openAnswerCollectionEditModal={openAnswerCollectionEditModal}
          />
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
      {creationMode && (
        <Button
          basic
          onClick={() => {
            // reset the selected items
            setAnswerCollectionEntries([])

            // reset the items selected as sample solutions
            solutionHelpers.setValue([])

            // reset the answer collection field to ensure that all fields update
            collectionHelpers.setValue(undefined)

            // switch to the creation mode for new answer collection options
            setItemSelectionMode('new')
          }}
          className={{
            root: 'text-primary-100 hover:text-primary-100 w-max px-0.5 py-1 text-sm hover:bg-transparent hover:underline',
          }}
          data={{ cy: `create-inline-answer-collection` }}
        >
          {t('manage.elements.enterSelectionItemsManually')}
        </Button>
      )}
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
              classNames={{ container: () => 'w-full' }}
              onChange={(newValue) =>
                solutionHelpers.setValue(newValue.map((tag) => tag.value))
              }
              placeholder={t('manage.elements.selectCorrectAnswerOptions')}
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

export default SelectionCollectionOptions
