import { faList, faPeopleGroup } from '@fortawesome/free-solid-svg-icons'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { trpc } from '@lib/trpc'
import { H4, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import ListButton from '../components/common/ListButton'

function Index() {
  const t = useTranslations()
  const {
    isLoading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = trpc.course.controlCourses.useQuery()
  const hasCoursesData = typeof dataCourses !== 'undefined'

  if (loadingCourses && !hasCoursesData) {
    return (
      <Layout title={t('control.home.courseSelection')}>
        <Loader />
      </Layout>
    )
  }

  if (errorCourses && !hasCoursesData) {
    return (
      <Layout title={t('control.home.courseSelection')}>
        <UserNotification
          type="error"
          className={{ root: 'text-base' }}
          message={t('control.course.loadingFailed')}
        />
      </Layout>
    )
  }

  if (!dataCourses) {
    return (
      <Layout title={t('control.home.courseSelection')}>
        <UserNotification
          type="error"
          className={{ root: 'text-base' }}
          message={t('control.course.loadingFailed')}
        />
      </Layout>
    )
  }

  return (
    <Layout title={t('control.home.courseSelection')}>
      <div className="flex w-full flex-col gap-4">
        {errorCourses && dataCourses ? (
          <UserNotification
            type="error"
            className={{ root: 'text-base' }}
            message={t('control.course.loadingFailed')}
          />
        ) : null}
        {dataCourses?.controlCourses && (
          <div>
            <H4>{t('control.home.selectCourse')}</H4>
            <div className="flex flex-col gap-2">
              {[...dataCourses?.controlCourses]
                .sort((a, b) => (a.isArchived ? 1 : -1))
                .map((course) => (
                  <ListButton
                    key={course.id}
                    link={`/course/${course.id}`}
                    icon={faPeopleGroup}
                    label={
                      !course.isArchived
                        ? course.name
                        : t
                            .rich('control.home.archivedCourse', {
                              courseName: course.name,
                            })
                            ?.toString() || course.name
                    }
                    data={{ cy: `course-${course.name}` }}
                  />
                ))}
            </div>
          </div>
        )}

        <div>
          <H4>{t('control.home.liveQuizzesNoCourse')}</H4>
          <div className="flex flex-col gap-2">
            <ListButton
              link="/course/unassigned"
              icon={faList}
              label={t('control.home.listLiveQuizzesNoCourse')}
              data={{ cy: 'unassigned-live-quizzes' }}
            />
          </div>
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
  }
}

export default Index
