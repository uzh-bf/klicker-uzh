import { faBookOpenReader } from '@fortawesome/free-solid-svg-icons'
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

type PracticeQuizOverviewData =
  RouterOutputs['participant']['coursePublishedPracticeQuizzes']

function PracticeQuizOverview({
  isInactive,
  courseId,
  initialPracticeQuizData,
  participantToken,
  cookiesAvailable,
}: {
  isInactive: boolean
  courseId: string
  initialPracticeQuizData?: PracticeQuizOverviewData
  participantToken?: string
  cookiesAvailable?: boolean
}) {
  const t = useTranslations()

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { data, error, isLoading } =
    trpc.participant.coursePublishedPracticeQuizzes.useQuery(
      { courseId },
      {
        enabled: !isInactive,
        initialData: initialPracticeQuizData,
      }
    )

  if (!isInactive && isLoading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  const quizzes = data?.practiceQuizzes
  const course = quizzes?.[0]?.course
  if (!isInactive && error && !quizzes) {
    return (
      <Layout>
        <div className="flex flex-col gap-3 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
          <H2>{t.rich('shared.generic.activePracticeQuizzes')}</H2>
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
            className={{ root: 'text-base' }}
          />
        </div>
      </Layout>
    )
  }

  if (
    isInactive ||
    !quizzes ||
    !quizzes?.length ||
    quizzes.length === 0 ||
    !course
  ) {
    return (
      <Layout>
        <div className="flex flex-col gap-3 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
          <H2>{t.rich('shared.generic.activePracticeQuizzes')}</H2>
          {!isInactive && error && data ? (
            <UserNotification
              type="error"
              message={t('shared.generic.systemError')}
              className={{ root: 'text-base' }}
            />
          ) : null}
          <UserNotification
            type="warning"
            message={t('pwa.general.noPracticeQuizzesActive')}
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
          {t('pwa.general.activePracticeQuizzesInCourse', {
            name: course.displayName,
          })}
        </H2>
        {error && data ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
            className={{ root: 'text-base' }}
          />
        ) : null}
        <div className="flex flex-col gap-1.5">
          {quizzes.map((quiz) => (
            <LinkButton
              key={quiz.id}
              icon={faBookOpenReader}
              href={`/course/${course.id}/practiceQuizzes/${quiz.id}`}
              data={{ cy: `open-practice-quiz-${quiz.name}` }}
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
    const result =
      await trpcClient.participant.coursePublishedPracticeQuizzes.query({
        courseId: ctx.params.courseId,
      })

    // if there is no result (e.g., the shortname is not valid)
    const quizzes = result.practiceQuizzes
    const course = quizzes?.[0]?.course
    if (!quizzes || !course) {
      return {
        props: {
          isInactive: true,
          courseId: ctx.params.courseId,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    // if only a single practice quiz is running, redirect directly to the corresponding quiz page
    // or if linkTo is set, redirect to the specified link
    if (quizzes.length === 1) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/course/${course.id}/practiceQuizzes/${quizzes[0].id}`,
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
          isInactive: false,
          participantToken,
          cookiesAvailable,
          courseId: ctx.params.courseId,
          initialPracticeQuizData: result,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    return {
      props: {
        isInactive: false,
        courseId: ctx.params.courseId,
        initialPracticeQuizData: result,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
  } catch (error) {
    console.error(
      'Error in getServerSideProps on practice quiz overview:',
      error
    )

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

export default PracticeQuizOverview
