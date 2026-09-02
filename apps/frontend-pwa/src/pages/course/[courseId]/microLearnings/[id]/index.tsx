import { useQuery } from '@apollo/client'
import {
  faClock,
  faQuestionCircle,
  faTimesCircle,
} from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetMicroLearningDocument,
  SelfDocument,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { Button, H3, Prose, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import nookies from 'nookies'
import Layout from '../../../../../components/Layout'
import PreviewMessage from '../../../../../components/common/PreviewMessage'
import MicroLearningSubscriber from '../../../../../components/microLearning/MicroLearningSubscriber'

function MicrolearningIntroduction({
  id,
  participantToken,
  cookiesAvailable,
}: {
  id: string
  participantToken?: string
  cookiesAvailable?: boolean
}) {
  const t = useTranslations()
  const router = useRouter()

  const pageInFrame =
    global?.window &&
    global?.window?.location !== global?.window?.parent.location

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { loading, error, data, subscribeToMore } = useQuery(
    GetMicroLearningDocument,
    {
      variables: { id },
      skip: !id,
    }
  )
  const { data: selfData } = useQuery(SelfDocument, {
    skip: data?.microLearning?.isOwner ?? false,
  })

  if (loading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (!data?.microLearning) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('pwa.microLearning.notFound')}
        />
      </Layout>
    )
  }

  if (error) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  const microLearning = data.microLearning
  const microLearningPast = dayjs(microLearning.scheduledEndAt).isBefore(
    dayjs()
  )

  return (
    <Layout
      displayName={microLearning.displayName}
      course={microLearning.course ?? undefined}
    >
      <MicroLearningSubscriber
        activityId={microLearning.id}
        microLearningName={microLearning.displayName}
        subscribeToMore={subscribeToMore}
      />
      <div className="flex w-full flex-col md:mx-auto md:w-full md:max-w-6xl md:rounded md:border md:p-8 md:pt-6">
        {(!selfData?.self || selfData.self.role !== UserRole.Participant) &&
          (microLearning.isOwner ? (
            <PreviewMessage
              activityType={t('shared.generic.microlearning')}
              name={microLearning.name}
              displayName={microLearning.displayName}
              className="mb-4"
            />
          ) : (
            <UserNotification type="warning" className={{ root: 'mb-4' }}>
              {pageInFrame
                ? t('pwa.general.userNotLoggedInFrame')
                : t.rich('pwa.general.userNotLoggedIn', {
                    login: (text) => (
                      <Button
                        basic
                        className={{
                          root: 'hover:text-primary-100 p-0! font-bold hover:bg-transparent',
                        }}
                        onClick={() =>
                          router.push(
                            `/login?expired=true&redirect_to=${
                              encodeURIComponent(
                                window?.location?.pathname +
                                  (window?.location?.search ?? '')
                              ) ?? '/'
                            }`
                          )
                        }
                        data={{ cy: 'login-to-start-microlearning' }}
                      >
                        <Button.Label>{text}</Button.Label>
                      </Button>
                    ),
                  })}
            </UserNotification>
          ))}
        {microLearningPast ? (
          <UserNotification
            type="warning"
            message={t('pwa.microLearning.activityExpired')}
            className={{ root: 'mb-4' }}
          />
        ) : null}
        <H3>{microLearning.displayName}</H3>
        <Prose
          className={{
            root: 'prose-p:mt-0 prose-headings:mt-0 prose-img:my-0 max-w-none hover:text-current',
          }}
        >
          <DynamicMarkdown content={microLearning.description ?? undefined} />
        </Prose>

        <div className="mb-4 grid grid-cols-1 gap-y-1 text-sm md:mb-0 md:grid-cols-2">
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faQuestionCircle} />
            <div>
              {t('pwa.microLearning.numOfQuestionSets', {
                number: microLearning.stacks?.length ?? 0,
              })}
            </div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faTimesCircle} />
            <div>
              {t('pwa.practiceQuiz.multiplicatorPoints', {
                mult: microLearning.pointsMultiplier,
              })}
            </div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faClock} />
            <div>
              {t('pwa.microLearning.availableFrom', {
                date: dayjs(microLearning.scheduledStartAt).format(
                  'DD.MM.YYYY HH:mm'
                ),
              })}
            </div>
          </div>
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faClock} />
            <div>
              {t('pwa.microLearning.availableUntil', {
                date: dayjs(microLearning.scheduledEndAt).format(
                  'DD.MM.YYYY HH:mm'
                ),
              })}
            </div>
          </div>
        </div>

        <Link
          href={`/course/${microLearning.course?.id}/microLearnings/${microLearning.id}/0`}
          legacyBehavior
        >
          <Button
            primary
            disabled={!microLearning.isOwner && microLearningPast}
            className={{
              root: 'w-full text-lg md:w-auto md:self-end',
            }}
            data={{ cy: 'start-microlearning' }}
          >
            <Button.Label>{t('shared.generic.begin')}</Button.Label>
          </Button>
        </Link>
      </div>
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { createSsrRequestLogging } = await import('@lib/server/logger')
  const { logFailure, requestContext } = createSsrRequestLogging(
    ctx.req.headers,
    '/course/:courseId/microLearnings/:id'
  )

  try {
    if (
      typeof ctx.params?.courseId !== 'string' ||
      typeof ctx.params?.id !== 'string'
    ) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
          permanent: false,
        },
      }
    }

    const apolloClient = initializeApollo(undefined, ctx, requestContext)

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
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/course/${ctx.params?.courseId}/microLearnings/${ctx.params?.id}`)}`,
        permanent: false,
      },
    }
  }
}

export default MicrolearningIntroduction
