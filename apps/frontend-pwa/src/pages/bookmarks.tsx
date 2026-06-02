import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import LinkButton from '../components/common/LinkButton'
import { trpc } from '../lib/trpc'

function Bookmarks() {
  const t = useTranslations()
  const { data, isLoading } = trpc.participant.courses.useQuery()

  if (isLoading && !data) {
    return (
      <Layout
        course={{ displayName: 'KlickerUZH' }}
        displayName={t('pwa.general.myBookmarks')}
      >
        <Loader />
      </Layout>
    )
  }

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={t('pwa.general.myBookmarks')}
    >
      <div className="flex flex-col gap-2 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
        <H1 className={{ root: 'text-xl' }}>{t('pwa.general.selectCourse')}</H1>
        {data?.participantCourses?.length === 0 && (
          <div className="flex flex-col gap-2">
            <UserNotification type="info">
              {t('pwa.courses.noBookmarksSet')}
            </UserNotification>
          </div>
        )}
        {data?.participantCourses?.map((course) => (
          <LinkButton
            key={course.id}
            href={`/course/${course.id}/bookmarks`}
            icon={faBookmark}
            data={{ cy: `bookmarks-course-${course.displayName}` }}
          >
            {course.displayName}
          </LinkButton>
        ))}
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

export default Bookmarks
