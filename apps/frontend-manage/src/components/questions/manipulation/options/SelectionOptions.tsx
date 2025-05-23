import { useQuery } from '@apollo/client'
import { GetAnswerCollectionsElementsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { ElementFormTypesSelection } from '../types'
import SelectionCollectionOptions from './SelectionCollectionOptions'
import SelectionManualItemCreation from './SelectionManualItemCreation'

interface SelectionOptionsProps {
  creationMode: boolean
  templateId?: string
  isTemplate: boolean
  inputsDisabled?: boolean
  values: ElementFormTypesSelection
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
}

function SelectionOptions({
  creationMode,
  templateId,
  isTemplate,
  inputsDisabled,
  values,
  setAnswerCollectionEntries,
}: SelectionOptionsProps) {
  const t = useTranslations()
  const [selectionMode, _, selectionModeHelpers] = useField<
    ElementFormTypesSelection['options']['itemSelectionMode']
  >('options.itemSelectionMode')

  const { data, loading, refetch } = useQuery(
    GetAnswerCollectionsElementsDocument,
    { variables: { templateId }, fetchPolicy: 'network-only' }
  )
  const collections = data?.getAnswerCollectionsElements ?? []

  if (loading) {
    return <Loader />
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
      refetchCollections={refetch}
      loading={loading}
      values={values}
      setAnswerCollectionEntries={setAnswerCollectionEntries}
      setItemSelectionMode={(newValue) =>
        selectionModeHelpers.setValue(newValue)
      }
    />
  )
}

export default SelectionOptions
