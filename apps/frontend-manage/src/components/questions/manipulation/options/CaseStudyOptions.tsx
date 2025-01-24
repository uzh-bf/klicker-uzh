import { useQuery } from '@apollo/client'
import { GetAnswerCollectionsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import CaseStudyCasesFields, {
  CaseStudySetterProps,
} from './CaseStudyCasesFields'
import CaseStudyCollectionSelection from './CaseStudyCollectionSelection'
import CaseStudyCriteriaFields from './CaseStudyCriteriaFields'
import useFormCollections from './useFormCollections'

function CaseStudyOptions({
  setFieldValue,
  setFieldTouched,
}: CaseStudySetterProps) {
  const t = useTranslations()
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
      <UserNotification
        type="warning"
        message={t('manage.questionForms.CSAnswerCollectionRequired')}
        className={{ root: 'text-base' }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CaseStudyCollectionSelection collections={collections} />
      <hr className="border-uzh-grey-40 my-2 w-full border-2" />
      <CaseStudyCriteriaFields />
      <hr className="border-uzh-grey-40 my-2 w-full border-2" />
      <CaseStudyCasesFields
        setFieldTouched={setFieldTouched}
        setFieldValue={setFieldValue}
      />
    </div>
  )
}

export default CaseStudyOptions
