import { useQuery } from '@apollo/client'
import { GetAnswerCollectionsElementsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Dispatch, SetStateAction, useState } from 'react'
import CaseStudyCasesFields, {
  CaseStudySetterProps,
} from './CaseStudyCasesFields'
import CaseStudyCollectionSelection from './CaseStudyCollectionSelection'
import CaseStudyCriteriaFields from './CaseStudyCriteriaFields'
import CaseStudyManualItemCreation from './CaseStudyManualItemCreation'

interface CaseStudyOptionsProps extends CaseStudySetterProps {
  creationMode: boolean
  templateId?: string
  isTemplate: boolean
  hasSampleSolution: boolean
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
}

function CaseStudyOptions({
  creationMode,
  templateId,
  isTemplate,
  inputsDisabled = false,
  setFieldValue,
  setFieldTouched,
  hasSampleSolution,
  setAnswerCollectionEntries,
}: CaseStudyOptionsProps) {
  const t = useTranslations()
  const [selectionMode, _, selectionModeHelpers] = useField<'existing' | 'new'>(
    'options.itemSelectionMode'
  )

  const [selectedItems, setSelectedItems] = useState<
    { id: number; name: string }[]
  >([])
  const {
    data,
    loading,
    refetch: refetchAnswerCollections,
  } = useQuery(GetAnswerCollectionsElementsDocument, {
    variables: { templateId },
    fetchPolicy: 'network-only',
  })
  const collections = data?.getAnswerCollectionsElements ?? []

  if (loading) {
    return <Loader />
  }

  if (collections.length === 0) {
    return (
      <UserNotification type="warning" className={{ root: 'text-base' }}>
        {t.rich('manage.elements.CSAnswerCollectionRequired', {
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
      {(selectionMode.value === 'existing' ||
        typeof selectionMode.value === 'undefined') && (
        <CaseStudyCollectionSelection
          loading={loading}
          disabled={inputsDisabled}
          creationMode={creationMode}
          isTemplate={isTemplate}
          collections={collections}
          setSelectedItems={setSelectedItems}
          hasSampleSolution={hasSampleSolution}
          itemSelectionMode={selectionMode.value}
          setAnswerCollectionEntries={setAnswerCollectionEntries}
          setItemSelectionMode={(newValue) =>
            selectionModeHelpers.setValue(newValue)
          }
          refetchAnswerCollections={async () =>
            await refetchAnswerCollections({ templateId })
          }
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
      <hr className="border-uzh-grey-40 my-2 w-full border-2" />
      <CaseStudyCriteriaFields disabled={inputsDisabled} />
      <hr className="border-uzh-grey-40 my-2 w-full border-2" />
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
