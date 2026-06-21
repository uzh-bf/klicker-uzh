import {
  faClock,
  faQuestionCircle,
  faTimesCircle,
} from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import getParticipantToken from '@lib/getParticipantToken'
import { trpc } from '@lib/trpc'
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

const PARTICIPANT_ROLE = 'PARTICIPANT'

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

  const utils = trpc.useUtils()
  const { isLoading, error, data } = trpc.participant.microLearning.useQuery(
    { id },
    { enabled: !!id }
  )
  const { data: selfData } = trpc.participant.self.useQuery(undefined, {
    enabled: !(data?.microLearning?.isOwner ?? false),
  })

  if (isLoading && !data) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (error && !data?.microLearning) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
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
        onEnded={(endedMicroLearning) =>
          utils.participant.microLearning.setData({ id }, (previous) =>
            previous?.microLearning
              ? {
                  microLearning: {
                    ...previous.microLearning,
                    ...endedMicroLearning,
                  },
                }
              : previous
          )
        }
      />
      <div className="flex w-full flex-col md:mx-auto md:w-full md:max-w-6xl md:rounded md:border md:p-8 md:pt-6">
        {(!selfData?.self || selfData.self.role !== PARTICIPANT_ROLE) &&
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

    const { participantToken, cookiesAvailable } = await getParticipantToken({
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

    return {
      props: {
        id: ctx.params.id,
        courseId: ctx.params.courseId,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
  } catch (error) {
    console.error('Error in getServerSideProps on microlearning:', error)

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
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/course/${ctx.params?.courseId}/microLearnings/${ctx.params?.id}`)}`,
        permanent: false,
      },
    }
  }
}

export default MicrolearningIntroduction
