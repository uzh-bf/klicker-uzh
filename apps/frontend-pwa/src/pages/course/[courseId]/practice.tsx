import { useQuery } from '@apollo/client'
import { GetCoursePracticeQuizDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import { useState } from 'react'
import Layout from '../../../components/Layout'
import Footer from '../../../components/common/Footer'
import PracticeQuiz, {
  resetPracticeQuizLocalStorage,
} from '../../../components/practiceQuiz/PracticeQuiz'

interface Props {
  courseId: string
  participantToken?: string
  cookiesAvailable?: boolean
}

function PracticePool({ courseId, participantToken, cookiesAvailable }: Props) {
  const t = useTranslations()

  const [currentIx, setCurrentIx] = useState(-1)
  const [roundComplete, setRoundComplete] = useState(false)
  const [preparingNextRound, setPreparingNextRound] = useState(false)
  const [roundRefreshError, setRoundRefreshError] = useState(false)

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { loading, error, data, refetch } = useQuery(
    GetCoursePracticeQuizDocument,
    {
      variables: { courseId },
    }
  )

  // Every branch of this route marks itself as an answering surface, including
  // the ones rendered before the pool has loaded: the layout decides on its
  // first render whether a product update may appear, and a later branch cannot
  // recall a request that the earlier one already sent.
  if (loading)
    return (
      <Layout activelyAnswering>
        <Loader />
      </Layout>
    )

  if (!data?.coursePracticeQuiz) {
    return (
      <Layout activelyAnswering>
        <UserNotification
          type="error"
          message={t('pwa.practiceQuiz.notFound')}
        />
      </Layout>
    )
  }
  if (error || roundRefreshError) {
    return <Layout activelyAnswering>{t('shared.generic.systemError')}</Layout>
  }

  const handleNextQuestion = () => {
    scrollTo(0, 0)
    setCurrentIx((ix) => ix + 1)
  }

  const handleAllStacksCompletion = async () => {
    scrollTo(0, 0)
    // A completed pool round starts fresh in the UI. The spaced repetition
    // schedule on the server is kept and re-selects the stacks of the next
    // round, which is why the query is refetched after resetting.
    resetPracticeQuizLocalStorage(courseId)
    setRoundComplete(false)
    setPreparingNextRound(true)
    setCurrentIx(-1)

    try {
      await refetch()
      setRoundComplete(true)
    } catch {
      setRoundRefreshError(true)
    } finally {
      setPreparingNextRound(false)
    }
  }

  return (
    <Layout
      activelyAnswering
      displayName={t('shared.generic.practiceTitle')}
      course={data.coursePracticeQuiz.course ?? undefined}
    >
      {roundComplete && currentIx === -1 && (
        <div data-cy="practice-pool-round-complete">
          <UserNotification
            type="success"
            message={t('pwa.general.practicePoolRoundComplete')}
          />
        </div>
      )}
      {preparingNextRound ? (
        <Loader />
      ) : (
        <PracticeQuiz
          quiz={{
            ...data?.coursePracticeQuiz,
            description: t('pwa.courses.coursePracticeArea', {
              courseName: data?.coursePracticeQuiz.course?.displayName ?? 0,
            }),
            course: data?.coursePracticeQuiz.course!,
          }}
          currentIx={currentIx}
          setCurrentIx={setCurrentIx}
          handleNextElement={handleNextQuestion}
          onAllStacksCompletion={handleAllStacksCompletion}
        />
      )}
      <Footer
        browserLink={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/practice`}
      />
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  try {
    if (typeof ctx.params?.courseId !== 'string') {
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
  } catch (error) {
    console.error('Error in getServerSideProps on practice:', error)

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
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/course/${ctx.params?.courseId}/practice`)}`,
        permanent: false,
      },
    }
  }
}

export default PracticePool
