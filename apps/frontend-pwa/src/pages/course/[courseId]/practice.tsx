import Loader from '@klicker-uzh/shared-components/src/Loader'
import getParticipantToken from '@lib/getParticipantToken'
import { trpc } from '@lib/trpc'
import useParticipantToken from '@lib/useParticipantToken'
import { UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
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

  const { data, error, isLoading } =
    trpc.participant.coursePracticeQuiz.useQuery({ courseId })

  if (isLoading && !data)
    return (
      <Layout>
        <Loader />
      </Layout>
    )

  if (error && !data?.practiceQuiz) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

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

  const handleNextQuestion = () => {
    scrollTo(0, 0)
    setCurrentIx((ix) => ix + 1)
  }

  return (
    <Layout
      displayName={t('shared.generic.practiceTitle')}
      course={data.practiceQuiz.course ?? undefined}
    >
      <PracticeQuiz
        quiz={{
          ...data.practiceQuiz,
          description: t('pwa.courses.coursePracticeArea', {
            courseName: data.practiceQuiz.course.displayName,
          }),
          course: data.practiceQuiz.course,
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
  try {
    if (typeof ctx.params?.courseId !== 'string') {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
          statusCode: 302,
        },
      }
    }

    const { participantToken, cookiesAvailable } = await getParticipantToken({
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

    return {
      props: {
        courseId: ctx.params.courseId,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
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
