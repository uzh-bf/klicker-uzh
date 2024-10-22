import { useQuery } from '@apollo/client'
import { GetCoursePracticeQuizDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import Layout from '../../../components/Layout'
import Footer from '../../../components/common/Footer'
import PracticeQuiz from '../../../components/practiceQuiz/PracticeQuiz'

interface Props {
  courseId: string
  participantToken?: string
  cookiesAvailable?: boolean
}

function PracticePool({ courseId, participantToken, cookiesAvailable }: Props) {
  const t = useTranslations()

  const [currentIx, setCurrentIx] = useState(-1)

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

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
          message={t('pwa.practiceQuiz.notFound')}
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
        quiz={{
          ...data?.coursePracticeQuiz,
          description: t('pwa.courses.coursePracticeArea', {
            courseName: data?.coursePracticeQuiz.course?.displayName,
          }),
          course: data?.coursePracticeQuiz.course!,
        }}
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

  const { participantToken, cookiesAvailable } = await getParticipantToken({
    apolloClient,
    courseId: ctx.params.courseId,
    ctx,
  })

  if (participantToken) {
    return {
      props: {
        participantToken,
        cookiesAvailable,
        courseId: ctx.params.courseId,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
  }

  return addApolloState(apolloClient, {
    props: {
      courseId: ctx.params.courseId,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default PracticePool
