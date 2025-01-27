import { useQuery } from '@apollo/client'
import { GetAnswerCollectionsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'
import CaseStudyCasesFields, {
  CaseStudySetterProps,
} from './CaseStudyCasesFields'
import CaseStudyCollectionSelection from './CaseStudyCollectionSelection'
import CaseStudyCriteriaFields from './CaseStudyCriteriaFields'
import useFormCollections from './useFormCollections'

interface CaseStudyOptionsProps extends CaseStudySetterProps {
  hasSampleSolution: boolean
}

function CaseStudyOptions({
  setFieldValue,
  setFieldTouched,
  hasSampleSolution,
}: CaseStudyOptionsProps) {
  const t = useTranslations()
  const [selectedItems, setSelectedItems] = useState<
    { id: number; name: string }[]
  >([])
  const { data, loading } = useQuery(GetAnswerCollectionsDocument)

  // combine all collections that are accessible to the user
  const collections = useFormCollections({
    dbCollections: data?.getAnswerCollections,
  })

  if (loading) {
    return <Loader />
  }

  if (collections.length === 0) {
    return (
      <UserNotification type="warning" className={{ root: 'text-base' }}>
        {t.rich('manage.questionForms.CSAnswerCollectionRequired', {
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
        collections={collections}
        setSelectedItems={setSelectedItems}
        hasSampleSolution={hasSampleSolution}
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
