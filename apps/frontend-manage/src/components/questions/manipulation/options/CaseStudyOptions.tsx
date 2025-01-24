import { useQuery } from '@apollo/client'
import { GetAnswerCollectionsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { ElementFormTypesCaseStudy } from '../types'
import CaseStudyCollectionSelection from './CaseStudyCollectionSelection'
import CaseStudyCriteriaFields from './CaseStudyCriteriaFields'
import useAnswerCollectionChangeEffect from './useAnswerCollectionChangeEffect'
import useFormCollections from './useFormCollections'
import useSelectAnswerCollectionOptions from './useSelectAnswerCollectionOptions'
import useSelectedAnswerEntry from './useSelectedAnswerEntry'

interface CaseStudyOptionsProps {
  values: ElementFormTypesCaseStudy
}

function CaseStudyOptions({ values }: CaseStudyOptionsProps) {
  const t = useTranslations()
  const [field, _, helpers] = useField<number[]>('options.selectedItems')
  const { data, loading } = useQuery(GetAnswerCollectionsDocument)

  // combine all collections that are accessible to the user
  const collections = useFormCollections({
    dbCollections: data?.getAnswerCollections,
  })

  // get all answer options from the selected collections
  const collectionAnswers = useSelectAnswerCollectionOptions({
    collectionId: values.options.answerCollection,
    collections,
  })

  // filter the available answer options for the ones included in the current form state
  const selectedAnswers = useSelectedAnswerEntry({
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
      <UserNotification
        type="warning"
        message={t('manage.questionForms.CSAnswerCollectionRequired')}
        className={{ root: 'text-base' }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CaseStudyCollectionSelection
        collections={collections}
        selectedAnswers={selectedAnswers}
        collectionAnswers={collectionAnswers}
        helpers={helpers}
      />
      <hr className="border-uzh-grey-40 my-2 w-full border-2" />
      <CaseStudyCriteriaFields criteriaValues={values.options.criteria} />
      <hr className="border-uzh-grey-40 my-2 w-full border-2" />
      {/* // TODO: extract to separate component */}
      <div>CASES /w CRITERIA SOLUTION RANGES IF DEFINED</div>
    </div>
  )
}

export default CaseStudyOptions
