import { useQuery } from '@apollo/client'
import {
  GetBasicCourseInformationDocument,
  GetBookmarkedQuestionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { H1, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'

function Bookmarks() {
  const t = useTranslations()
  const router = useRouter()

  const { data } = useQuery(GetBookmarkedQuestionsDocument, {
    variables: { courseId: router.query.courseId as string },
    skip: !router.query.courseId,
  })

  const { data: courseData } = useQuery(GetBasicCourseInformationDocument, {
    variables: { courseId: router.query.courseId as string },
  })

  // TODO: replace with learning element implementation including all questions
  // TODO: add navigation that is possible by name

  return (
    <Layout
      course={courseData?.basicCourseInformation ?? undefined}
      displayName={t('shared.generic.bookmarks')}
    >
      <div className="flex flex-col gap-2 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H1 className={{ root: 'text-xl' }}>{t('shared.generic.bookmarks')}</H1>
        <UserNotification
          // TODO: delete this translation, once the notification is replaced with the bookmarked questions
          message={t('pwa.general.bookmarksPlaceholder')}
          type="info"
        />
        {/* {data?.getBookmarkedQuestions?.map((question) => (
          <div key={question.id}>{question.questionData.name}</div>
        ))} */}
      </div>
    </Layout>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
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
