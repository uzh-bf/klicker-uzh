import { useQuery } from '@apollo/client'
import { GetCoursePracticeQuizDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import Layout from '../../../components/Layout'
import Footer from '../../../components/common/Footer'
import PracticeQuiz from '../../../components/practiceQuiz/PracticeQuiz'

interface Props {
  courseId: string
}

function PracticePool({ courseId }: Props) {
  const t = useTranslations()

  const [currentIx, setCurrentIx] = useState(-1)

  const { loading, error, data } = useQuery(GetCoursePracticeQuizDocument, {
    variables: { courseId },
  })

  if (loading)
    return (
      <Layout>
        <Loader />
      </Layout>
    )

  if (!data?.coursePracticeQuiz) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('pwa.learningElement.notFound')}
        />
      </Layout>
    )
  }
  if (error) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  const handleNextQuestion = () => {
    scrollTo(0, 0)
    setCurrentIx((ix) => ix + 1)
  }

  return (
    <Layout
      displayName={t('shared.generic.practiceTitle')}
      course={data.coursePracticeQuiz.course ?? undefined}
    >
      <PracticeQuiz
        quiz={data?.coursePracticeQuiz}
        currentIx={currentIx}
        setCurrentIx={setCurrentIx}
        handleNextElement={handleNextQuestion}
      />
      <Footer
        browserLink={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/practice`}
      />
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (typeof ctx.params?.courseId !== 'string') {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  const apolloClient = initializeApollo()

  const { participantToken, participant } = await getParticipantToken({
    apolloClient,
    ctx,
  })

  return addApolloState(apolloClient, {
    props: {
      courseId: ctx.params.courseId,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default PracticePool
