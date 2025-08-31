import { useQuery } from '@apollo/client'
import {
  GetPracticeQuizDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import { useState } from 'react'
import Layout from '../../../../components/Layout'
import Footer from '../../../../components/common/Footer'
import PracticeQuiz from '../../../../components/practiceQuiz/PracticeQuiz'

function PracticeQuizPage({
  courseId,
  id,
  participantToken,
  cookiesAvailable,
}: {
  courseId: string
  id: string
  participantToken?: string
  cookiesAvailable?: boolean
}) {
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
  if (
    data.practiceQuiz.status === PublicationStatus.Scheduled &&
    !data.practiceQuiz.isOwner
  ) {
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
        showResetLocalStorage
        quiz={{
          ...data.practiceQuiz,
          course: data.practiceQuiz.course!,
        }}
        currentIx={currentIx}
        setCurrentIx={setCurrentIx}
        handleNextElement={handleNextQuestion}
        previewOnly={data.practiceQuiz.isOwner ?? undefined}
      />
      <Footer
        browserLink={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/practiceQuizzes/${id}`}
      />
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  try {
    if (
      typeof ctx.params?.courseId !== 'string' ||
      typeof ctx.params?.id !== 'string'
    ) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
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
  } catch (error) {
    console.error('Error in getServerSideProps on practice quiz:', error)

    // remove the lti-token, if it is defined
    try {
      nookies.destroy(ctx, 'lti-token', {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      })
    } catch (nookiesError) {
      console.error(nookiesError)
    }

    // redirect to lti error page with redirect back to this page
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/course/${ctx.params?.courseId}/practiceQuizzes/${ctx.params?.id}`)}`,
        permanent: false,
      },
    }
  }
}

export default PracticeQuizPage
