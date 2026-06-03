import { faChalkboardUser } from '@fortawesome/free-solid-svg-icons'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import getParticipantToken from '@lib/getParticipantToken'
import { createTRPCSSRClient, trpc, type RouterOutputs } from '@lib/trpc'
import useParticipantToken from '@lib/useParticipantToken'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import Layout from '../../../../components/Layout'
import LinkButton from '../../../../components/common/LinkButton'

type LiveQuizOverviewData =
  RouterOutputs['participant']['courseRunningLiveQuizzes']

function LiveQuizOverview({
  isInactive,
  courseId,
  initialLiveQuizData,
  participantToken,
  cookiesAvailable,
}: {
  isInactive: boolean
  courseId: string
  initialLiveQuizData?: LiveQuizOverviewData
  participantToken?: string
  cookiesAvailable?: boolean
}) {
  const t = useTranslations()

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { data, isLoading } =
    trpc.participant.courseRunningLiveQuizzes.useQuery(
      { courseId },
      {
        enabled: !isInactive,
        initialData: initialLiveQuizData,
      }
    )

  if (!isInactive && isLoading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  const liveQuizzes = data?.liveQuizzes ?? []
  const course = liveQuizzes[0]?.course
  if (isInactive || liveQuizzes.length === 0 || !course) {
    return (
      <Layout>
        <div className="flex flex-col gap-3 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
          <H2>{t.rich('shared.generic.activeLiveQuizzes')}</H2>
          <UserNotification
            type="warning"
            message={t('pwa.general.noLiveQuizzesActive')}
            className={{ root: 'text-base' }}
          />
        </div>
      </Layout>
    )
  }

  return (
    <Layout course={course}>
      <div className="flex flex-col gap-2 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
        <H2>
          {t('pwa.general.activeLiveQuizzesInCourse', {
            name: course.displayName,
          })}
        </H2>
        <div className="flex flex-col gap-1.5">
          {liveQuizzes.map((quiz) => (
            <LinkButton
              key={quiz.id}
              icon={faChalkboardUser}
              href={`/session/${quiz.id}`}
              data={{ cy: `join-live-quiz-${quiz.name}` }}
              className={{ root: 'gap-1 text-base', icon: 'h-5 w-5' }}
            >
              {quiz.displayName}
            </LinkButton>
          ))}
        </div>
      </div>
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

    const trpcClient = createTRPCSSRClient(ctx)
    const result = await trpcClient.participant.courseRunningLiveQuizzes.query({
      courseId: ctx.params.courseId,
    })

    // if there is no result (e.g., the shortname is not valid)
    if (!result?.liveQuizzes) {
      return {
        props: {
          isInactive: true,
          courseId: ctx.params.courseId,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    // if only a single live quiz is running, redirect directly to the corresponding quiz page
    // or if linkTo is set, redirect to the specified link
    if (result.liveQuizzes.length === 1) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/session/${result.liveQuizzes[0].id}`,
          permanent: false,
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
          initialLiveQuizData: result,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    return {
      props: {
        courseId: ctx.params.courseId,
        initialLiveQuizData: result,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
  } catch (error) {
    console.error('Error in getServerSideProps on live quiz overview:', error)

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
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/course/${ctx.params?.courseId}/liveQuizzes/overview`)}`,
        permanent: false,
      },
    }
  }
}

export default LiveQuizOverview
