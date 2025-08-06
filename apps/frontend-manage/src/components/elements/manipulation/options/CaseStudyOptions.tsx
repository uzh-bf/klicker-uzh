import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useField } from 'formik'
import { Dispatch, SetStateAction, useState } from 'react'
import { ElementFormTypesCaseStudy } from '../types'
import CaseStudyCasesFields, {
  CaseStudySetterProps,
} from './CaseStudyCasesFields'
import CaseStudyCollectionSelection from './CaseStudyCollectionSelection'
import CaseStudyCriteriaFields from './CaseStudyCriteriaFields'
import CaseStudyManualItemCreation from './CaseStudyManualItemCreation'

interface CaseStudyOptionsProps extends CaseStudySetterProps {
  creationMode: boolean
  hasSampleSolution: boolean
  collections: Omit<AnswerCollection, 'description'>[]
  collectionsLoading: boolean
  refetchCollections: () => Promise<any>
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
  openAnswerCollectionEditModal: (collectionId: number) => void
}

function CaseStudyOptions({
  creationMode,
  inputsDisabled = false,
  setFieldValue,
  setFieldTouched,
  hasSampleSolution,
  collections,
  collectionsLoading,
  refetchCollections,
  setAnswerCollectionEntries,
  openAnswerCollectionEditModal,
}: CaseStudyOptionsProps) {
  const [selectionMode, _, selectionModeHelpers] = useField<
    ElementFormTypesCaseStudy['options']['itemSelectionMode']
  >('options.itemSelectionMode')

  const [selectedItems, setSelectedItems] = useState<
    { id: number; name: string }[]
  >([])

  if (collectionsLoading) {
    return <Loader />
  }

  return (
    <div className="flex flex-col gap-1.5">
      {(selectionMode.value === 'existing' ||
        typeof selectionMode.value === 'undefined') && (
        <CaseStudyCollectionSelection
          loading={collectionsLoading}
          disabled={inputsDisabled}
          creationMode={creationMode}
          collections={collections}
          setSelectedItems={setSelectedItems}
          hasSampleSolution={hasSampleSolution}
          setAnswerCollectionEntries={setAnswerCollectionEntries}
          setItemSelectionMode={(newValue) =>
            selectionModeHelpers.setValue(newValue)
          }
          refetchCollections={async () => await refetchCollections()}
          openAnswerCollectionEditModal={openAnswerCollectionEditModal}
        />
      )}
      {creationMode && selectionMode.value === 'new' && (
        <CaseStudyManualItemCreation
          disabled={inputsDisabled}
          itemSelectionMode={selectionMode.value}
          setItemSelectionMode={(newValue) =>
            selectionModeHelpers.setValue(newValue)
          }
          setAnswerCollectionEntries={setAnswerCollectionEntries}
          setSelectedItems={setSelectedItems}
        />
      )}
      <hr className="border-border my-2 w-full border-2" />
      <CaseStudyCriteriaFields disabled={inputsDisabled} />
      <hr className="border-border my-2 w-full border-2" />
      <CaseStudyCasesFields
        inputsDisabled={inputsDisabled}
        setFieldTouched={setFieldTouched}
        setFieldValue={setFieldValue}
        hasSampleSolution={hasSampleSolution}
        selectedItems={selectedItems}
      />
    </div>
  )
}

export default CaseStudyOptions
