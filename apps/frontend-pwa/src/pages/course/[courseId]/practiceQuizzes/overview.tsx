import { useQuery } from '@apollo/client'
import { faBookOpenReader, faRepeat } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCoursePublishedPracticeQuizzesDocument,
  SelfDocument,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { H2, H3, UserNotification } from '@uzh-bf/design-system'
import type { GetServerSidePropsContext } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import LinkButton from '../../../../components/common/LinkButton'
import Layout from '../../../../components/Layout'

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
  const { data: selfData } = useQuery(SelfDocument)

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
        <div
          className="flex flex-col gap-3 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8"
          data-cy="practice-quiz-overview-empty"
        >
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

  const showPracticePool = selfData?.self?.role === UserRole.Participant

  return (
    <Layout course={course}>
      <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
        <H2>
          {t('pwa.general.activePracticeQuizzesInCourse', {
            name: course.displayName,
          })}
        </H2>
        {showPracticePool && (
          <Link
            href={`/course/${course.id}/practice`}
            data-cy="open-practice-pool"
            className="flex min-h-24 w-full items-center gap-4 rounded bg-uzh-blue p-4 text-white transition-colors hover:bg-uzh-blue-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uzh-blue"
          >
            <FontAwesomeIcon
              icon={faRepeat}
              className="h-7 w-7 flex-none"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-semibold leading-tight">
                {t('pwa.general.practicePoolPromotionTitle')}
              </span>
              <span className="mt-1 block text-base leading-snug">
                {t('pwa.general.practicePoolPromotionDescription')}
              </span>
              <span className="mt-3 inline-block rounded border border-white px-3 py-1 font-semibold">
                {t('pwa.general.startPracticePool')}
              </span>
            </span>
          </Link>
        )}
        <H3 className={{ root: 'mb-0 text-lg' }}>
          {t('pwa.general.individualPracticeQuizzes')}
        </H3>
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

    const apolloClient = initializeApollo()
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
