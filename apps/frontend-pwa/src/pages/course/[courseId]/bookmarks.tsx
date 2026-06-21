import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import Layout from '../../../components/Layout'
import PracticeQuiz from '../../../components/practiceQuiz/PracticeQuiz'
import { trpc } from '../../../lib/trpc'

type BookmarksPracticeQuiz = Parameters<typeof PracticeQuiz>[0]['quiz']

function Bookmarks() {
  const t = useTranslations()
  const router = useRouter()
  const [currentIx, setCurrentIx] = useState(-1)
  const courseId =
    typeof router.query.courseId === 'string' ? router.query.courseId : ''

  const handleNextQuestion = () => {
    scrollTo(0, 0)
    setCurrentIx((ix) => ix + 1)
  }

  const {
    data: bookmarksPageData,
    error,
    isLoading,
  } = trpc.participant.bookmarksPageData.useQuery(
    { courseId },
    { enabled: courseId !== '' }
  )

  const name = t('pwa.courses.bookmarkedQuestionsTitle', {
    courseName: bookmarksPageData?.course?.displayName ?? '',
  })
  const description = t('pwa.courses.bookmarkedQuestionsDesc', {
    courseName: bookmarksPageData?.course?.displayName ?? '',
  })

  const quiz = useMemo(() => {
    return {
      name: name,
      displayName: name,
      description: description,
      id: 'bookmarks',
      orderType: 'SPACED_REPETITION',
      pointsMultiplier: 1,
      status: 'PUBLISHED',
      course: bookmarksPageData?.course,
      stacks: bookmarksPageData?.stacks,
    } as unknown as BookmarksPracticeQuiz
  }, [name, description, bookmarksPageData?.course, bookmarksPageData?.stacks])

  if (courseId === '' || isLoading) {
    return (
      <Layout displayName={t('shared.generic.bookmarks')}>
        <Loader />
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout displayName={t('shared.generic.bookmarks')}>
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  return (
    <Layout
      course={bookmarksPageData?.course ?? undefined}
      displayName={t('shared.generic.bookmarks')}
    >
      {quiz.course && quiz.stacks && quiz.stacks.length > 0 ? (
        <PracticeQuiz
          quiz={{ ...quiz, course: quiz.course! }}
          currentIx={currentIx}
          setCurrentIx={setCurrentIx}
          handleNextElement={handleNextQuestion}
          showResetLocalStorage
        />
      ) : (
        <UserNotification type="info">
          {t('pwa.courses.noBookmarksSet')}
        </UserNotification>
      )}
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

export default Bookmarks
