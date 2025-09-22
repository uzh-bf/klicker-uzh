import { useQuery } from '@apollo/client'
import { GetAssessmentResultsLiveQuizDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import Layout from '../../../../../components/Layout'
import LiveQuizStudentResultsTable from '../../../../../components/liveQuiz/results/LiveQuizStudentResultsTable'

function AssessmentLiveQuiz() {
  const t = useTranslations()
  const router = useRouter()
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null)

  const { data, loading, error } = useQuery(
    GetAssessmentResultsLiveQuizDocument,
    {
      variables: { liveQuizId: router.query.quizId as string },
      skip: !router.query.quizId,
    }
  )

  if (loading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  const quiz = data?.assessmentResultsLiveQuiz
  if (error || !quiz) {
    // TODO: show error message
    return null
  }

  const studentResults = quiz.studentResults ?? []

  return (
    <Layout>
      <H2>{`${t('manage.assessment.assessmentResults')} - ${t('shared.generic.liveQuiz')}: ${quiz.name}`}</H2>
      <div className="flex w-full flex-row gap-2">
        <div className="w-1/2">
          <LiveQuizStudentResultsTable
            studentResults={studentResults}
            selectedParticipantId={selectedParticipantId}
            onSelect={setSelectedParticipantId}
          />
        </div>
        <div className="w-1/2 pl-4">
          RIGHT SIDE: INDIVIDUAL STUDENT RESULTS FOR EACH INSTANCE - AND
          possibility to open modal with element instance and submitted result
        </div>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default AssessmentLiveQuiz
