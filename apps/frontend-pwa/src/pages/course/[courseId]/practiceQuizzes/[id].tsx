/**
 * Embedded quiz postMessage protocol (for parent/embedding apps):
 *
 * When loaded with ?embed=true, this page posts messages to window.parent:
 *   { type: 'klicker:quiz-state', payload: { status, currentStep, totalSteps } }
 *
 * status values:
 *   'overview'    - quiz not yet started (or data still loading)
 *   'in-progress' - student is answering questions
 *   'completed'   - all stacks answered, quiz finished
 *
 * Example listener in the embedding app:
 *
 *   function useKlickerQuizState(iframeOrigin: string) {
 *     const [quizState, setQuizState] = useState({ status: 'overview' })
 *     useEffect(() => {
 *       const handler = (e: MessageEvent) => {
 *         if (e.origin !== iframeOrigin) return
 *         if (e.data?.type === 'klicker:quiz-state') setQuizState(e.data.payload)
 *       }
 *       window.addEventListener('message', handler)
 *       return () => window.removeEventListener('message', handler)
 *     }, [iframeOrigin])
 *     return quizState
 *   }
 *
 *   // Usage: hide e-learning "Weiter" until quiz is completed
 *   const quizState = useKlickerQuizState('https://pwa.klicker.uzh.ch')
 *   {quizState.status === 'completed' && <button>Weiter</button>}
 */
import { useQuery } from '@apollo/client'
import {
  GetPracticeQuizDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { parseEmbedParam } from '@klicker-uzh/shared-components/src/utils/parseEmbedParam'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import { useEffect, useRef, useState } from 'react'
import Layout from '../../../../components/Layout'
import Footer from '../../../../components/common/Footer'
import PracticeQuiz from '../../../../components/practiceQuiz/PracticeQuiz'

function PracticeQuizPage({
  courseId,
  id,
  participantToken,
  cookiesAvailable,
  embedded,
}: {
  courseId: string
  id: string
  participantToken?: string
  cookiesAvailable?: boolean
  embedded: boolean
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

  // track whether quiz was ever started to distinguish overview vs completed
  const hasStarted = useRef(false)
  if (currentIx >= 0) {
    hasStarted.current = true
  }

  // post quiz state to parent window when embedded
  const totalSteps = data?.practiceQuiz?.stacks?.length ?? 0
  useEffect(() => {
    if (!embedded) return

    let status: 'overview' | 'in-progress' | 'completed'
    if (currentIx === -1) {
      status = hasStarted.current ? 'completed' : 'overview'
    } else {
      status = 'in-progress'
    }

    window.parent.postMessage(
      {
        type: 'klicker:quiz-state',
        payload: {
          status,
          currentStep: currentIx + 1,
          totalSteps,
        },
      },
      '*'
    )
  }, [embedded, currentIx, totalSteps])

  if (loading)
    return (
      <Layout embedded={embedded}>
        <Loader />
      </Layout>
    )

  if (!data?.practiceQuiz) {
    return (
      <Layout embedded={embedded}>
        <UserNotification
          type="error"
          message={t('pwa.practiceQuiz.notFound')}
        />
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout embedded={embedded}>{t('shared.generic.systemError')}</Layout>
    )
  }

  // show notification with activity start date
  if (
    data.practiceQuiz.status === PublicationStatus.Scheduled &&
    !data.practiceQuiz.isOwner
  ) {
    return (
      <Layout
        embedded={embedded}
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
      embedded={embedded}
      displayName={data.practiceQuiz.displayName}
      course={data.practiceQuiz.course ?? undefined}
    >
      <PracticeQuiz
        showResetLocalStorage
        embedded={embedded}
        quiz={{
          ...data.practiceQuiz,
          course: data.practiceQuiz.course!,
        }}
        currentIx={currentIx}
        setCurrentIx={setCurrentIx}
        handleNextElement={handleNextQuestion}
        onAllStacksCompletion={
          embedded
            ? () => {
                setCurrentIx(-1)
              }
            : undefined
        }
        previewOnly={data.practiceQuiz.isOwner ?? undefined}
      />
      {!embedded && (
        <Footer
          browserLink={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/practiceQuizzes/${id}`}
        />
      )}
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

    const embedded = parseEmbedParam(ctx.query.embed)

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
          embedded,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    return addApolloState(apolloClient, {
      props: {
        id: ctx.params.id,
        courseId: ctx.params.courseId,
        embedded,
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
