import { useQuery } from '@apollo/client'
import { GetCourseStudentTimelinesDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import TimelineCourse from '~/components/insights/timeline/TimelineCourse'
import Layout from '../../components/Layout'

function StudentTimelines() {
  const t = useTranslations()
  const { data, loading } = useQuery(GetCourseStudentTimelinesDocument)

  if (loading) {
    return (
      <Layout
        course={{ displayName: 'KlickerUZH' }}
        displayName={`${t('pwa.general.insights')} - ${t('pwa.general.timeline')}`}
      >
        <Loader />
      </Layout>
    )
  }

  const courses = data?.getCourseStudentTimelines

  // TODO: extract components for course information and chart to separate components
  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={`${t('pwa.general.insights')} - ${t('pwa.general.timeline')}`}
    >
      {!courses || courses.length === 0 ? (
        <UserNotification
          type="info"
          message={t('pwa.insights.noCourseDataAvailable')}
        />
      ) : (
        <div className="flex flex-col gap-12 md:gap-5">
          {courses.map((course) => (
            <TimelineCourse
              key={`timeline-insights-course-${course.courseId}`}
              course={course}
            />
          ))}
        </div>
      )}
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

export default StudentTimelines
