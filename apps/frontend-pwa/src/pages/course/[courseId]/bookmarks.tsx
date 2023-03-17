import { useQuery } from '@apollo/client'
import LinkButton from '@components/common/LinkButton'
import {
  GetBasicCourseInformationDocument,
  GetBookmarkedQuestionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { H1 } from '@uzh-bf/design-system'
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

  const reducedStacks = data?.getBookmarkedQuestions?.reduce(
    (acc: any, questionStack: any) => {
      const questionNamesString = questionStack.elements
        .map((element: any) => element.questionInstance?.questionData.name)
        .filter((name: any) => (name ? name : undefined))
        .join(', ')
      return [
        ...acc,
        {
          id: questionStack.id,
          displayName: questionStack.displayName,
          questionNamesString,
        },
      ]
    },
    []
  )

  return (
    <Layout
      course={courseData?.basicCourseInformation ?? undefined}
      displayName={t('shared.generic.bookmarks')}
    >
      <div className="flex flex-col gap-2 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H1 className={{ root: 'text-xl' }}>{t('shared.generic.bookmarks')}</H1>
        {reducedStacks?.map((stack) => (
          <LinkButton
            key={stack.displayName}
            href={`/course/${router.query.courseId}/bookmark/${stack.id}`}
          >
            <div>
              {stack.displayName || stack.questionNamesString.length !== 0
                ? stack.questionNamesString
                : t('pwa.learningElement.infoStack')}
            </div>
          </LinkButton>
        ))}
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
