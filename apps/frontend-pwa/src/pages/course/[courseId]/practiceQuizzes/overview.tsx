import { useQuery } from '@apollo/client'
import { faBookOpenReader } from '@fortawesome/free-solid-svg-icons'
import { GetCoursePublishedPracticeQuizzesDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import Layout from '../../../../components/Layout'
import LinkButton from '../../../../components/common/LinkButton'

function PracticeQuizOverview({
  isInactive,
  courseId,
  participantToken,
  cookiesAvailable,
}: {
  isInactive: boolean
  courseId: string
  participantToken?: string
  cookiesAvailable?: boolean
}) {
  const t = useTranslations()

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { data, loading } = useQuery(
    GetCoursePublishedPracticeQuizzesDocument,
    {
      variables: { courseId: courseId },
      skip: isInactive,
    }
  )

  if (loading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  const quizzes = data?.getCoursePublishedPracticeQuizzes
  const course = quizzes?.[0]?.course
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
  const { createSsrRequestLogging } = await import('@lib/server/logger')
  const { logFailure, requestContext } = createSsrRequestLogging(
    ctx.req.headers,
    '/course/:courseId/practiceQuizzes/overview'
  )

  try {
    if (typeof ctx.params?.courseId !== 'string') {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
          statusCode: 302,
        },
      }
    }

    const apolloClient = initializeApollo(undefined, ctx, requestContext)
    const result = await apolloClient.query({
      query: GetCoursePublishedPracticeQuizzesDocument,
      variables: {
        courseId: ctx.params.courseId,
      },
    })

    // if there is no result (e.g., the shortname is not valid)
    const quizzes = result.data.getCoursePublishedPracticeQuizzes
    const course = quizzes?.[0]?.course
    if (!result?.data?.getCoursePublishedPracticeQuizzes || !course) {
      return {
        props: {
          isInactive: true,
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
  } catch {
    logFailure('data_load_failed')

    // remove the lti-token, if it is defined
    try {
      nookies.destroy(ctx, 'lti-token', {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      })
    } catch {
      logFailure('cookie_cleanup_failed')
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
