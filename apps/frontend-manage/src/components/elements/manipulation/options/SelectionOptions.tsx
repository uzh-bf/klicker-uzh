import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import type { AnswerCollection } from '../../../../lib/constants/elementTypes'
import { ElementFormTypesSelection } from '../types'
import SelectionCollectionOptions from './SelectionCollectionOptions'
import SelectionManualItemCreation from './SelectionManualItemCreation'

interface SelectionOptionsProps {
  creationMode: boolean
  inputsDisabled?: boolean
  values: ElementFormTypesSelection
  collections: Omit<AnswerCollection, 'description'>[]
  collectionsLoading: boolean
  collectionsError: boolean
  collectionsRefetching: boolean
  refetchCollections: () => Promise<any>
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
  openAnswerCollectionEditModal: (collectionId: number) => void
}

function SelectionOptions({
  creationMode,
  inputsDisabled,
  values,
  collections,
  collectionsLoading,
  collectionsError,
  collectionsRefetching,
  refetchCollections,
  setAnswerCollectionEntries,
  openAnswerCollectionEditModal,
}: SelectionOptionsProps) {
  const t = useTranslations()
  const [selectionMode, _, selectionModeHelpers] = useField<
    ElementFormTypesSelection['options']['itemSelectionMode']
  >('options.itemSelectionMode')

  if (collectionsLoading) {
    return <Loader />
  }

  if (collectionsError) {
    return (
      <UserNotification
        type="error"
        message={t('shared.generic.systemError')}
        className={{ root: 'text-sm' }}
      />
    )
  }

  // if an existing answer collection is / will be selected, show the corresponding selection dropdown
  if (
    typeof selectionMode.value !== 'undefined' &&
    selectionMode.value === 'new'
  ) {
    return (
      <SelectionManualItemCreation
        inputsDisabled={inputsDisabled}
        values={values}
        setAnswerCollectionEntries={setAnswerCollectionEntries}
        setItemSelectionMode={(newValue) =>
          selectionModeHelpers.setValue(newValue)
        }
      />
    )
  }

  // default creation mode based on existing answer collection
  return (
    <SelectionCollectionOptions
      creationMode={creationMode}
      inputsDisabled={inputsDisabled}
      collections={collections}
      refetchCollections={refetchCollections}
      loading={collectionsRefetching}
      values={values}
      setAnswerCollectionEntries={setAnswerCollectionEntries}
      setItemSelectionMode={(newValue) =>
        selectionModeHelpers.setValue(newValue)
      }
      openAnswerCollectionEditModal={openAnswerCollectionEditModal}
    />
  )
}

export default SelectionOptions
