import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import CourseCollapsible from '../components/practiceQuiz/CourseCollapsible'
import { trpc } from '../lib/trpc'

function Repetition() {
  const t = useTranslations()
  const { data, error, isLoading } =
    trpc.participant.practiceQuizList.useQuery()

  if (isLoading) {
    return (
      <Layout
        course={{ displayName: 'KlickerUZH' }}
        displayName={t('pwa.practiceQuiz.repetitionTitle')}
      >
        <Loader />
      </Layout>
    )
  }

  if (error || !data) {
    return (
      <Layout
        course={{ displayName: 'KlickerUZH' }}
        displayName={t('pwa.practiceQuiz.repetitionTitle')}
      >
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  // reduce the data to a map of course names to a list of elements together with their corresponding type
  const courses = data.practiceQuizList.map((course) => {
    return {
      id: course.id,
      displayName: course.displayName,
      elements:
        course.practiceQuizzes.map((element) => {
          return {
            id: element.id,
            displayName: element.displayName,
          }
        }) || [],
    }
  })

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={t('shared.generic.practiceQuizzes')}
    >
      <div className="flex flex-col gap-3 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
        <H2>{t('shared.generic.practiceQuizzes')}</H2>
        {courses?.length
          ? courses.map((course) => (
              <CourseCollapsible
                key={`list-${course.id}`}
                courseId={course.id}
                courseName={course.displayName}
                elements={course.elements}
              />
            ))
          : null}

        {courses?.length === 0 && (
          <UserNotification
            type="info"
            // TODO: change message to no courses available
            message={t('pwa.practiceQuiz.noRepetition')}
          />
        )}
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Repetition
