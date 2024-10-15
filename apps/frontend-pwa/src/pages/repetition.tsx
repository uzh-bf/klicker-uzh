import { useQuery } from '@apollo/client'
import { GetPracticeQuizListDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import CourseCollapsible from '../components/practiceQuiz/CourseCollapsible'

function Repetition() {
  const t = useTranslations()
  const { data, loading } = useQuery(GetPracticeQuizListDocument)

  if (loading) {
    return (
      <Layout
        course={{ displayName: 'KlickerUZH' }}
        displayName={t('pwa.practiceQuiz.repetitionTitle')}
      >
        <Loader />
      </Layout>
    )
  }

  // reduce the data to a map of course names to a list of elements together with their corresponding type
  const courses = data?.getPracticeQuizList?.map((course) => {
    return {
      id: course.id,
      displayName: course.displayName,
      elements:
        course.practiceQuizzes?.map((element) => {
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
      displayName={t('pwa.practiceQuiz.repetitionTitle')}
    >
      <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
        <H1 className={{ root: 'text-xl' }}>
          {t('shared.generic.repetition')}
        </H1>
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
