import { useQuery } from '@apollo/client'
import {
  GetBasicCourseInformationDocument,
  GetBookmarkedQuestionsDocument,
  LearningElementStatus,
  LearningElement as LearningElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import Layout from '../../../components/Layout'
import LearningElement from '../../../components/learningElements/LearningElement'

function Bookmarks() {
  const t = useTranslations()
  const router = useRouter()
  const [currentIx, setCurrentIx] = useState(-1)

  const handleNextQuestion = () => {
    scrollTo(0, 0)
    setCurrentIx((ix) => ix + 1)
  }

  const { data: bookmarkedQuestions } = useQuery(
    GetBookmarkedQuestionsDocument,
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

  const elementData = useMemo(() => {
    return {
      name: name,
      displayName: name,
      description: description,
      id: '',
      orderType: 'LAST_RESPONSE',
      pointsMultiplier: 1,
      // TODO: fix to actually check if questions have been answered
      previouslyAnswered:
        bookmarkedQuestions?.getBookmarkedQuestions?.length ?? 0,
      // TODO: fix to correct number, where stack actually contains questionInstance
      stacksWithQuestions:
        bookmarkedQuestions?.getBookmarkedQuestions?.length ?? 0,
      numOfQuestions: bookmarkedQuestions?.getBookmarkedQuestions?.length ?? 0,
      // TODO: reintroduce these parameters, if required / helpful
      // previousPointsAwarded?: Maybe<Scalars['Float']>;
      // previousScore?: Maybe<Scalars['Float']>;
      // resetTimeDays?: Maybe<Scalars['Int']>;
      // totalTrials?: Maybe<Scalars['Int']>;
      status: LearningElementStatus.Published,
      stacks: bookmarkedQuestions?.getBookmarkedQuestions ?? [],
    } as LearningElementType
  }, [bookmarkedQuestions?.getBookmarkedQuestions, description, name])

  return (
    <Layout
      course={courseData?.basicCourseInformation ?? undefined}
      displayName={t('shared.generic.bookmarks')}
    >
      <LearningElement
        element={elementData}
        currentIx={currentIx}
        setCurrentIx={setCurrentIx}
        handleNextQuestion={handleNextQuestion}
      />
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetServerSidePropsContext) {
  return {
    props: {
      messages: (
        await import(
          `@klicker-uzh/shared-components/src/intl-messages/${locale}.json`
        )
      ).default,
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
