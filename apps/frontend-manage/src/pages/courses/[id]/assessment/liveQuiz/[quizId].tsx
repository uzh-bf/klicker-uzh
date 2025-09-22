import { useQuery } from '@apollo/client'
import { GetAssessmentResultsLiveQuizDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Suspense, useState } from 'react'
import Layout from '../../../../../components/Layout'
import LiveQuizSingleStudentResults from '../../../../../components/liveQuiz/results/LiveQuizSingleStudentResults'
import LiveQuizStudentResultsTable from '../../../../../components/liveQuiz/results/LiveQuizStudentResultsTable'

function AssessmentLiveQuiz() {
  const t = useTranslations()
  const router = useRouter()
  const [selectedParticipant, setSelectedParticipant] = useState<{
    id: string
    email: string
  } | null>(null)

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
    return (
      <UserNotification
        type="error"
        message={t('manage.assessment.errorLoadingLiveQuizResults')}
      />
    )
  }

  const studentResults = quiz.studentResults ?? []

  return (
    <Layout>
      <H2>{`${t('manage.assessment.assessmentResults')} - ${t('shared.generic.liveQuiz')}: ${quiz.name}`}</H2>
      <div className="flex w-full flex-row gap-2">
        <div className="w-1/2">
          <LiveQuizStudentResultsTable
            quizName={quiz.name}
            studentResults={studentResults}
            selectedParticipantId={selectedParticipant?.id ?? null}
            onSelect={setSelectedParticipant}
            availableBasePoints={quiz.availableBasePoints}
            availableCorrectnessPoints={quiz.availableCorrectnessPoints}
            availableBonusPoints={quiz.availableBonusPoints}
          />
        </div>
        <div className="mt-11 w-1/2 pl-4">
          {!!selectedParticipant ? (
            <Suspense>
              <LiveQuizSingleStudentResults
                liveQuizId={router.query.quizId as string}
                participantId={selectedParticipant.id}
                participantEmail={selectedParticipant.email}
                quizBasePoints={quiz.quizBasePoints}
                quizCorrectnessPoints={quiz.quizCorrectnessPoints}
                quizBonusPoints={quiz.quizBonusPoints}
              />
            </Suspense>
          ) : (
            <UserNotification
              type="info"
              message={t('manage.assessment.liveQuizSelectStudentInfo')}
            />
          )}
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
