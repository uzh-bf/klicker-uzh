import { useQuery } from '@apollo/client'
import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetParticipantCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import Layout from '../components/Layout'

function Bookmarks() {
  const t = useTranslations()
  const { data, loading } = useQuery(GetParticipantCoursesDocument)

  if (loading && !data) {
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
      <div className="flex flex-col gap-2 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H1 className={{ root: 'text-xl' }}>{t('pwa.general.selectCourse')}</H1>
        {data?.participantCourses?.length === 0 && (
          <div className="flex flex-col gap-2">
            <UserNotification type="info">
              {t('pwa.courses.noBooksmarksSet')}
            </UserNotification>
          </div>
        )}
        {data?.participantCourses?.map((course) => (
          <Link key={course.id} href={`/course/${course.id}/bookmarks`}>
            <Button
              fluid
              className={{
                root: twMerge(
                  'gap-5 px-4 py-2 text-lg shadow bg-uzh-grey-20 sm:hover:bg-uzh-grey-40'
                ),
              }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faBookmark} />
              </Button.Icon>
              <Button.Label className={{ root: 'flex-1 text-left' }}>
                <div>{course.displayName}</div>
              </Button.Label>
            </Button>
          </Link>
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
