import { faPenToSquare } from '@fortawesome/free-regular-svg-icons'
import { faListCheck } from '@fortawesome/free-solid-svg-icons'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H2, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Suspense, useState } from 'react'
import Layout from '../../../../components/Layout'
import PointCorrectionsModal from '../../../../components/courses/PointCorrectionsModal'
import PreviousCorrectionsListModal from '../../../../components/courses/pointCorrections/PreviousCorrectionsListModal'
import AssessmentStudentResultsTable, {
  PageSizeOption,
} from '../../../../components/liveQuiz/results/AssessmentStudentResultsTable'
import CourseSingleStudentResults from '../../../../components/liveQuiz/results/CourseSingleStudentResults'
import { trpc } from '../../../../lib/trpc'

function CourseAssessmentResults() {
  const t = useTranslations()
  const router = useRouter()

  const [correctionsModal, setCorrectionsModal] = useState(false)
  const [pageSizeOption, setPageSizeOption] = useState<PageSizeOption>('15')
  const [previousCorrectionsModal, setPreviousCorrectionsModal] =
    useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<{
    id: string
    email: string
  } | null>(null)

  const courseId = typeof router.query.id === 'string' ? router.query.id : ''
  const { data, isLoading, error } =
    trpc.activity.assessmentResultsCourse.useQuery(
      { courseId },
      { enabled: Boolean(courseId) }
    )

  if (isLoading || !courseId) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  const course = data?.assessmentResultsCourse
  if (error || !course) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('manage.assessment.errorLoadingCourseResults')}
        />
      </Layout>
    )
  }

  const studentResults = course.studentResults ?? []

  return (
    <Layout>
      <div className="mb-2 flex flex-row justify-between">
        <H2>{`${t('manage.assessment.assessmentResults')} - ${t('shared.generic.course')}: ${course.name}`}</H2>

        <div className="flex flex-row gap-2">
          {course.numberOfCorrections > 0 && (
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
            quizName={course.name}
            studentResults={studentResults}
            selectedParticipantId={selectedParticipant?.id ?? null}
            onSelect={setSelectedParticipant}
            availableBasePoints={course.availableBasePoints}
            availableCorrectnessPoints={course.availableCorrectnessPoints}
            availableBonusPoints={course.availableBonusPoints}
            pageSizeOption={pageSizeOption}
            setPageSizeOption={setPageSizeOption}
          />
        </div>
        <div className="mt-11 w-1/2 pl-4">
          {!!selectedParticipant ? (
            <Suspense>
              <CourseSingleStudentResults
                courseId={courseId}
                participantId={selectedParticipant.id}
              />
            </Suspense>
          ) : (
            <UserNotification
              type="info"
              message={t('manage.assessment.courseSelectStudentInfo')}
            />
          )}
        </div>
      </div>

      {correctionsModal ? (
        <PointCorrectionsModal
          courseId={courseId}
          onClose={() => setCorrectionsModal(false)}
        />
      ) : null}

      {course.numberOfCorrections > 0 &&
      previousCorrectionsModal &&
      courseId ? (
        <PreviousCorrectionsListModal
          courseId={courseId}
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

export default CourseAssessmentResults
