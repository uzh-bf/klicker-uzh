import { useQuery } from '@apollo/client'
import { GetSingleQuestionStackDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import Layout from '../../../../components/Layout'
import QuestionStack from '../../../../components/learningElements/QuestionStack'

function BookmarkedStack() {
  const router = useRouter()

  const { data } = useQuery(GetSingleQuestionStackDocument, {
    variables: {
      id: typeof router.query.id === 'string' ? parseInt(router.query.id) : -1,
    },
    skip: !router.query.id || typeof router.query.id !== 'string',
  })

  return (
    <Layout displayName="blabla" course={{ id: '' }}>
      <div className="flex-1 space-y-4 md:max-w-6xl md:mx-auto md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
        {data?.questionStack && (
          <QuestionStack
            stack={data?.questionStack}
            elementId={router.query.id as string}
            currentStep={0}
            totalSteps={1}
            handleNextQuestion={() =>
              router.push(`/course/${router.query.courseId}/bookmarks`)
            }
          />
        )}
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

export default BookmarkedStack
