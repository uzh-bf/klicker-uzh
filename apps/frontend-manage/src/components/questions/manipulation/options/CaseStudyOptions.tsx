import { useQuery } from '@apollo/client'
import { GetAnswerCollectionsElementsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Dispatch, SetStateAction, useState } from 'react'
import CaseStudyCasesFields, {
  CaseStudySetterProps,
} from './CaseStudyCasesFields'
import CaseStudyCollectionSelection from './CaseStudyCollectionSelection'
import CaseStudyCriteriaFields from './CaseStudyCriteriaFields'

interface CaseStudyOptionsProps extends CaseStudySetterProps {
  templateId?: string
  isTemplate: boolean
  hasSampleSolution: boolean
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
}

function CaseStudyOptions({
  templateId,
  isTemplate,
  setFieldValue,
  setFieldTouched,
  hasSampleSolution,
  setAnswerCollectionEntries,
}: CaseStudyOptionsProps) {
  const t = useTranslations()
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
        {t.rich('manage.elementForms.CSAnswerCollectionRequired', {
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
      <CaseStudyCollectionSelection
        loading={loading}
        isTemplate={isTemplate}
        collections={collections}
        setSelectedItems={setSelectedItems}
        hasSampleSolution={hasSampleSolution}
        setAnswerCollectionEntries={setAnswerCollectionEntries}
        refetchAnswerCollections={async () =>
          await refetchAnswerCollections({ templateId })
        }
      />
      <hr className="border-uzh-grey-40 my-2 w-full border-2" />
      <CaseStudyCriteriaFields />
      <hr className="border-uzh-grey-40 my-2 w-full border-2" />
      <CaseStudyCasesFields
        setFieldTouched={setFieldTouched}
        setFieldValue={setFieldValue}
        hasSampleSolution={hasSampleSolution}
        selectedItems={selectedItems}
      />
    </div>
  )
}

export default CaseStudyOptions
