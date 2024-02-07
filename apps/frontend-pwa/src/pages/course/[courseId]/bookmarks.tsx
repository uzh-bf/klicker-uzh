import { useQuery } from '@apollo/client'
import {
  ElementOrderType,
  GetBasicCourseInformationDocument,
  GetBookmarkedElementStacksDocument,
  PracticeQuizStatus,
  PracticeQuiz as PracticeQuizType,
} from '@klicker-uzh/graphql/dist/ops'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import Layout from '../../../components/Layout'
import PracticeQuiz from '../../../components/practiceQuiz/PracticeQuiz'

function Bookmarks() {
  const t = useTranslations()
  const router = useRouter()
  const [currentIx, setCurrentIx] = useState(-1)

  const handleNextQuestion = () => {
    scrollTo(0, 0)
    setCurrentIx((ix) => ix + 1)
  }

  const { data: bookmarkedStacks } = useQuery(
    GetBookmarkedElementStacksDocument,
    {
      variables: { courseId: router.query.courseId as string },
      skip: !router.query.courseId,
    }
  )

  const { data: courseData } = useQuery(GetBasicCourseInformationDocument, {
    variables: { courseId: router.query.courseId as string },
  })

  const name = t('pwa.courses.bookmarkedQuestionsTitle', {
    courseName: courseData?.basicCourseInformation?.displayName ?? '',
  })
  const description = t('pwa.courses.bookmarkedQuestionsDesc', {
    courseName: courseData?.basicCourseInformation?.displayName ?? '',
  })

  const quiz = useMemo(() => {
    return {
      name: name,
      displayName: name,
      description: description,
      id: `bookmarks-${router.query.courseId}`,
      orderType: ElementOrderType.SpacedRepetition,
      pointsMultiplier: 1,
      status: PracticeQuizStatus.Published,
      course: courseData?.basicCourseInformation,
      stacks: bookmarkedStacks?.getBookmarkedElementStacks,
    } as PracticeQuizType
  }, [
    name,
    description,
    router.query.courseId,
    courseData?.basicCourseInformation,
    bookmarkedStacks?.getBookmarkedElementStacks,
  ])

  return (
    <Layout
      course={courseData?.basicCourseInformation ?? undefined}
      displayName={t('shared.generic.bookmarks')}
    >
      {quiz.stacks && quiz.stacks.length > 0 ? (
        <PracticeQuiz
          quiz={quiz}
          currentIx={currentIx}
          setCurrentIx={setCurrentIx}
          handleNextElement={handleNextQuestion}
          showResetLocalStorage
        />
      ) : (
        'No bookmarks'
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
