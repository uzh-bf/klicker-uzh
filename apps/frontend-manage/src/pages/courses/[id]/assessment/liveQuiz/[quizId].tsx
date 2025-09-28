import { useQuery } from '@apollo/client'
import { faPenToSquare } from '@fortawesome/free-regular-svg-icons'
import { faListCheck } from '@fortawesome/free-solid-svg-icons'
import { GetAssessmentResultsLiveQuizDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H2, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Suspense, useState } from 'react'
import PreviousCorrectionsListModal from '~/components/courses/pointCorrections/PreviousCorrectionsListModal'
import PointCorrectionsModal from '~/components/courses/PointCorrectionsModal'
import Layout from '../../../../../components/Layout'
import LiveQuizSingleStudentResults from '../../../../../components/liveQuiz/results/LiveQuizSingleStudentResults'
import LiveQuizStudentResultsTable from '../../../../../components/liveQuiz/results/LiveQuizStudentResultsTable'

function AssessmentLiveQuiz() {
  const t = useTranslations()
  const router = useRouter()

  const [correctionsModal, setCorrectionsModal] = useState(false)
  const [previousCorrectionsModal, setPreviousCorrectionsModal] =
    useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<{
    id: string
    email: string
  } | null>(null)

  // load the quiz results
  const { data, loading, error } = useQuery(
    GetAssessmentResultsLiveQuizDocument,
    {
      variables: { liveQuizId: router.query.quizId as string },
      skip: !router.query.quizId,
      fetchPolicy: 'network-only',
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
      <div className="mb-2 flex flex-row justify-between">
        <H2>{`${t('manage.assessment.assessmentResults')} - ${t('shared.generic.liveQuiz')}: ${quiz.name}`}</H2>

        <div className="flex flex-row gap-2">
          {quiz.numberOfCorrections > 0 && (
            <Button
              onClick={() => setPreviousCorrectionsModal(true)}
              className={{ root: 'h-8' }}
              data={{ cy: 'assessment-quiz-applied-corrections' }}
            >
              <Button.Icon icon={faListCheck} />
              <Button.Label>
                {t('manage.course.appliedCorrections')}
              </Button.Label>
            </Button>
          )}
          <Button
            onClick={() => setCorrectionsModal(true)}
            className={{ root: 'h-8' }}
            data={{ cy: 'assessment-quiz-point-corrections' }}
          >
            <Button.Icon icon={faPenToSquare} />
            <Button.Label>{t('manage.course.pointCorrections')}</Button.Label>
          </Button>
        </div>
      </div>
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

      {correctionsModal && router.query.id ? (
        <PointCorrectionsModal
          courseId={router.query.id as string}
          onClose={() => setCorrectionsModal(false)}
          preselectedLiveQuizId={router.query.quizId as string}
        />
      ) : null}

      {quiz.numberOfCorrections > 0 &&
      previousCorrectionsModal &&
      router.query.id ? (
        <PreviousCorrectionsListModal
          liveQuizId={router.query.quizId as string}
          instanceId={undefined}
          onClose={() => setPreviousCorrectionsModal(false)}
        />
      ) : null}
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
