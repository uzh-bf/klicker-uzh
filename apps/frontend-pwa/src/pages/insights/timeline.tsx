import Loader from '@klicker-uzh/shared-components/src/Loader'
import { trpc } from '@lib/trpc'
import { UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import TimelineCourse from '../../components/insights/timeline/TimelineCourse'
import Layout from '../../components/Layout'

function StudentTimelines() {
  const t = useTranslations()
  const { data, error, isLoading } =
    trpc.participant.courseStudentTimelines.useQuery()

  if (isLoading) {
    return (
      <Layout
        course={{ displayName: 'KlickerUZH' }}
        displayName={`${t('pwa.general.insights')} - ${t('pwa.general.timeline')}`}
      >
        <Loader />
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout
        course={{ displayName: 'KlickerUZH' }}
        displayName={`${t('pwa.general.insights')} - ${t('pwa.general.timeline')}`}
      >
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  const courses = data?.courseStudentTimelines

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
