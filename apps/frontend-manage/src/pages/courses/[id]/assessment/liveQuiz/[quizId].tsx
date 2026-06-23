import { faPenToSquare } from '@fortawesome/free-regular-svg-icons'
import { faListCheck } from '@fortawesome/free-solid-svg-icons'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H2, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Suspense, useEffect, useState } from 'react'
import PreviousCorrectionsListModal from '../../../../../components/courses/pointCorrections/PreviousCorrectionsListModal'
import PointCorrectionsModal from '../../../../../components/courses/PointCorrectionsModal'
import Layout from '../../../../../components/Layout'
import AssessmentStudentResultsTable, {
  PageSizeOption,
} from '../../../../../components/liveQuiz/results/AssessmentStudentResultsTable'
import LiveQuizSingleStudentResults from '../../../../../components/liveQuiz/results/LiveQuizSingleStudentResults'
import { trpc } from '../../../../../lib/trpc'

function AssessmentLiveQuiz() {
  const t = useTranslations()
  const router = useRouter()

  const [pageSizeOption, setPageSizeOption] = useState<PageSizeOption>('15')
  const [correctionsModal, setCorrectionsModal] = useState(false)
  const [previousCorrectionsModal, setPreviousCorrectionsModal] =
    useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<{
    id: string
    email: string
  } | null>(null)

  const courseId = typeof router.query.id === 'string' ? router.query.id : ''
  const liveQuizId =
    typeof router.query.quizId === 'string' ? router.query.quizId : ''
  const participantIdParam =
    typeof router.query.participantId === 'string'
      ? router.query.participantId
      : undefined

  // load the quiz results
  const { data, isLoading, error } =
    trpc.activity.assessmentResultsLiveQuiz.useQuery(
      { liveQuizId },
      { enabled: Boolean(liveQuizId) }
    )

  // if a specific participant is selected through a query parameter, display all students and select them in the table
  useEffect(() => {
    if (!router.isReady) return

    if (participantIdParam && data?.assessmentResultsLiveQuiz) {
      const participant = data.assessmentResultsLiveQuiz.studentResults.find(
        (result) => result.participantId === participantIdParam
      )
      if (participant) {
        setPageSizeOption('all') // show all students if a specific one is selected
        setSelectedParticipant({
          id: participant.participantId,
          email: participant.participantEmail,
        })
      }
    }
  }, [router.isReady, participantIdParam, data])

  const quiz = data?.assessmentResultsLiveQuiz

  if ((isLoading && !quiz) || !liveQuizId) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (error && !quiz) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('manage.assessment.errorLoadingLiveQuizResults')}
        />
      </Layout>
    )
  }

  if (!quiz) {
    return (
      <Layout>
        <UserNotification
          type="warning"
          message={t('manage.assessment.errorLoadingLiveQuizResults')}
        />
      </Layout>
    )
  }

  const studentResults = quiz.studentResults ?? []

  return (
    <Layout>
      {error && quiz ? (
        <UserNotification
          type="error"
          message={t('manage.assessment.errorLoadingLiveQuizResults')}
          className={{ root: 'mb-4' }}
        />
      ) : null}
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
          <AssessmentStudentResultsTable
            quizName={quiz.name}
            studentResults={studentResults}
            selectedParticipantId={selectedParticipant?.id ?? null}
            onSelect={setSelectedParticipant}
            availableBasePoints={quiz.availableBasePoints}
            availableCorrectnessPoints={quiz.availableCorrectnessPoints}
            availableBonusPoints={quiz.availableBonusPoints}
            pageSizeOption={pageSizeOption}
            setPageSizeOption={setPageSizeOption}
          />
        </div>
        <div className="mt-11 w-1/2 pl-4">
          {!!selectedParticipant ? (
            <Suspense>
              <LiveQuizSingleStudentResults
                courseId={courseId}
                liveQuizId={liveQuizId}
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

      {correctionsModal && courseId ? (
        <PointCorrectionsModal
          courseId={courseId}
          onClose={() => setCorrectionsModal(false)}
          preselectedLiveQuizId={liveQuizId}
        />
      ) : null}

      {quiz.numberOfCorrections > 0 && previousCorrectionsModal && courseId ? (
        <PreviousCorrectionsListModal
          liveQuizId={liveQuizId}
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
