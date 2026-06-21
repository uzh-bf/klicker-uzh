import { faBookOpenReader } from '@fortawesome/free-solid-svg-icons'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import getParticipantToken from '@lib/getParticipantToken'
import { createTRPCSSRClient, trpc, type RouterOutputs } from '@lib/trpc'
import useParticipantToken from '@lib/useParticipantToken'
import { H2, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import Layout from '../../../../components/Layout'
import LinkButton from '../../../../components/common/LinkButton'

type MicroLearningOverviewData =
  RouterOutputs['participant']['coursePublishedMicroLearnings']

function MicroLearningsOverview({
  isInactive,
  courseId,
  initialMicroLearningData,
  participantToken,
  cookiesAvailable,
}: {
  isInactive: boolean
  courseId: string
  initialMicroLearningData?: MicroLearningOverviewData
  participantToken?: string
  cookiesAvailable?: boolean
}) {
  const t = useTranslations()

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { data, error, isLoading } =
    trpc.participant.coursePublishedMicroLearnings.useQuery(
      { courseId },
      {
        enabled: !isInactive,
        initialData: initialMicroLearningData,
      }
    )

  if (!isInactive && isLoading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  const microLearnings = data?.microLearnings
  const course = microLearnings?.[0]?.course
  if (!isInactive && error && !microLearnings) {
    return (
      <Layout>
        <div className="flex flex-col gap-3 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
          <H2>{t.rich('shared.generic.activeMicroLearnings')}</H2>
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
    !microLearnings ||
    !microLearnings?.length ||
    microLearnings.length === 0 ||
    !course
  ) {
    return (
      <Layout>
        <div className="flex flex-col gap-3 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
          <H2>{t.rich('shared.generic.activeMicroLearnings')}</H2>
          <UserNotification
            type="warning"
            message={t('pwa.general.noMicroLearningsActive')}
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
          {t('pwa.general.activeMicroLearningsInCourse', {
            name: course.displayName,
          })}
        </H2>
        <div className="flex flex-col gap-1.5">
          {microLearnings.map((microlearning) => (
            <LinkButton
              key={microlearning.id}
              icon={faBookOpenReader}
              href={`/course/${course.id}/microLearnings/${microlearning.id}`}
              data={{ cy: `open-microlearning-${microlearning.name}` }}
              className={{ root: 'gap-1 text-base', icon: 'h-5 w-5' }}
            >
              <div>{microlearning.displayName}</div>
              <div className="text-sm text-gray-600">
                {`${dayjs(microlearning.scheduledStartAt).format(
                  'DD.MM.YYYY HH:mm'
                )} - ${dayjs(microlearning.scheduledEndAt).format('DD.MM.YYYY HH:mm')}`}
              </div>
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
      await trpcClient.participant.coursePublishedMicroLearnings.query({
        courseId: ctx.params.courseId,
      })

    // if there is no result (e.g., the shortname is not valid)
    const microLearnings = result.microLearnings
    const course = microLearnings?.[0]?.course
    if (!microLearnings || !course) {
      return {
        props: {
          isInactive: true,
          courseId: ctx.params.courseId,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    // if only a single microlearning is published, redirect directly to the corresponding microlearning page
    if (microLearnings.length === 1) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/course/${course.id}/microLearnings/${microLearnings[0].id}`,
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
          initialMicroLearningData: result,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    return {
      props: {
        isInactive: false,
        courseId: ctx.params.courseId,
        initialMicroLearningData: result,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
  } catch (error) {
    console.error(
      'Error in getServerSideProps on microlearnings overview page:',
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
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/course/${ctx.params?.courseId}/microLearnings`)}`,
        permanent: false,
      },
    }
  }
}

export default MicroLearningsOverview
