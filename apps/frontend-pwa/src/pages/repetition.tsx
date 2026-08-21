import { useQuery } from '@apollo/client'
import { faRepeat } from '@fortawesome/free-solid-svg-icons'
import { GetPracticeQuizListWithPersonalElementsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import LinkButton from '../components/common/LinkButton'
import CourseCollapsible from '../components/practiceQuiz/CourseCollapsible'

function Repetition() {
  const t = useTranslations()
  const { data, loading } = useQuery(
    GetPracticeQuizListWithPersonalElementsDocument
  )

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
      personalElementCount: course.personalElementCount ?? 0,
      personalDueCount: course.personalDueCount ?? 0,
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
      displayName={t('shared.generic.practiceQuizzes')}
    >
      <div className="flex flex-col gap-3 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
        <H2>{t('shared.generic.practiceQuizzes')}</H2>
        {courses?.length
          ? courses.map((course) => (
              <div key={`list-${course.id}`} className="flex flex-col gap-2">
                <CourseCollapsible
                  courseId={course.id}
                  courseName={course.displayName}
                  elements={course.elements}
                />
                {course.personalElementCount > 0 ? (
                  <LinkButton
                    href={`/course/${course.id}/personal`}
                    icon={faRepeat}
                    data={{ cy: `personal-elements-course-${course.id}` }}
                  >
                    {t('pwa.personalElements.repetitionLink', {
                      count: course.personalDueCount,
                    })}
                  </LinkButton>
                ) : null}
              </div>
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
