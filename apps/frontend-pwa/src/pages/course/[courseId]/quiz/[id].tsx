import { useQuery } from '@apollo/client'
import {
  GetPracticeQuizDocument,
  PracticeQuiz as PracticeQuizType,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import Layout from '../../../../components/Layout'
import Footer from '../../../../components/common/Footer'
import PracticeQuiz from '../../../../components/practiceQuiz/PracticeQuiz'
import { getParticipantToken, useParticipantToken } from '../../../../lib/token'

interface Props {
  courseId: string
  id: string
  participantToken?: string
  cookiesAvailable?: boolean
}

function PracticeQuizPage({
  courseId,
  id,
  participantToken,
  cookiesAvailable,
}: Props) {
  const t = useTranslations()

  const [currentIx, setCurrentIx] = useState(-1)

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { loading, error, data } = useQuery(GetPracticeQuizDocument, {
    variables: { id },
  })

  if (loading)
    return (
      <Layout>
        <Loader />
      </Layout>
    )

  if (!data?.practiceQuiz) {
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

  // show notification with activity start date
  if (data.practiceQuiz.status === PublicationStatus.Scheduled) {
    return (
      <Layout
        displayName={data.practiceQuiz.displayName}
        course={data.practiceQuiz.course ?? undefined}
      >
        <UserNotification
          type="warning"
          message={t('pwa.practiceQuiz.scheduledAvailableFrom', {
            name: data.practiceQuiz.displayName,
            date: dayjs(data.practiceQuiz.availableFrom).format(
              'DD.MM.YYYY HH:mm'
            ),
          })}
        />
      </Layout>
    )
  }

  const handleNextQuestion = () => {
    scrollTo(0, 0)
    setCurrentIx((ix) => ix + 1)
  }

  return (
    <Layout
      displayName={data.practiceQuiz.displayName}
      course={data.practiceQuiz.course ?? undefined}
    >
      <PracticeQuiz
        quiz={{
          ...(data.practiceQuiz as PracticeQuizType),
          course: data.practiceQuiz.course!,
        }}
        currentIx={currentIx}
        setCurrentIx={setCurrentIx}
        handleNextElement={handleNextQuestion}
        showResetLocalStorage
      />
      <Footer
        browserLink={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/quiz/${id}`}
      />
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (
    typeof ctx.params?.courseId !== 'string' ||
    typeof ctx.params?.id !== 'string'
  ) {
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
    ctx,
  })

  if (participantToken) {
    return {
      props: {
        participantToken,
        cookiesAvailable,
        id: ctx.params.id,
        courseId: ctx.params.courseId,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
  }

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
      courseId: ctx.params.courseId,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default PracticeQuizPage
