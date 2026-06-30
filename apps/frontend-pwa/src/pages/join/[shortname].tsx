import {
  faClipboardCheck,
  faCrown,
  faLock,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import getParticipantToken from '@lib/getParticipantToken'
import { createTRPCSSRClient, trpc, type RouterOutputs } from '@lib/trpc'
import useParticipantToken from '@lib/useParticipantToken'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import nookies from 'nookies'
import Layout from '../../components/Layout'
import LinkButton from '../../components/common/LinkButton'

function Join({
  isInactive,
  shortname,
  initialShortnameQuizData,
  participantToken,
  cookiesAvailable,
}: {
  isInactive: boolean
  shortname: string
  initialShortnameQuizData?: RouterOutputs['participant']['shortnameQuizzes']
  participantToken?: string
  cookiesAvailable?: boolean
}) {
  const t = useTranslations()

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { data, error, isLoading } = trpc.participant.shortnameQuizzes.useQuery(
    { shortname },
    {
      enabled: !isInactive,
      initialData: initialShortnameQuizData,
    }
  )
  const shortnameQuizzes = data?.shortnameQuizzes

  if (!isInactive && isLoading && !shortnameQuizzes) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (!isInactive && error && !shortnameQuizzes) {
    return (
      <Layout>
        <div className="flex flex-col gap-3 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
          <H2>
            {t.rich('pwa.general.activeLiveQuizzesBy', {
              i: (text) => <span className="italic">{text}</span>,
              name: shortname,
            })}
          </H2>
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
            className={{ root: 'text-base' }}
          />
        </div>
      </Layout>
    )
  }

  if (isInactive || !shortnameQuizzes || shortnameQuizzes.length === 0) {
    return (
      <Layout>
        <div className="flex flex-col gap-3 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
          <H2>
            {t.rich('pwa.general.activeLiveQuizzesBy', {
              i: (text) => <span className="italic">{text}</span>,
              name: shortname,
            })}
          </H2>
          {error && shortnameQuizzes ? (
            <UserNotification
              type="error"
              message={t('shared.generic.systemError')}
              className={{ root: 'text-base' }}
            />
          ) : null}
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
    <Layout>
      <div className="flex flex-col gap-2 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
        <H2>
          {t('pwa.general.activeLiveQuizzesBy', {
            name: shortname,
          })}
        </H2>
        {error && shortnameQuizzes ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
            className={{ root: 'text-base' }}
          />
        ) : null}
        <div className="-mt-1 mb-1 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm text-gray-600 sm:mb-0 sm:mt-0">
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon
              icon={faCrown}
              className="mb-0.5 w-3.5 text-orange-400"
            />
            {t('shared.generic.gamified')}
          </span>
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon
              icon={faClipboardCheck}
              className="text-uzh-red-100 mb-0.5 w-3.5"
            />
            {t('shared.generic.assessment')}
          </span>
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon
              icon={faLock}
              className="text-primary-100 mb-0.5 w-3.5"
            />
            {t('shared.generic.pinProtected')}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {shortnameQuizzes.map((quiz) => (
            <LinkButton
              key={quiz.id}
              href={`/session/${quiz.id}`}
              data={{ cy: `join-live-quiz-${quiz.name}` }}
              className={{ root: 'gap-1 text-lg', icon: 'h-5 w-5' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 whitespace-normal">
                  {quiz.displayName}{' '}
                  {quiz.course && `in ${quiz.course?.displayName}`}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm text-gray-600">
                  {quiz.isGamificationEnabled && (
                    <span
                      className="flex items-center"
                      title={t('shared.generic.gamified')}
                      aria-label={t('shared.generic.gamified')}
                    >
                      <FontAwesomeIcon
                        icon={faCrown}
                        className="mb-0.5 w-3.5 text-orange-400"
                      />
                    </span>
                  )}
                  {quiz.isAssessmentEnabled && (
                    <span
                      className="flex items-center"
                      title={t('shared.generic.assessment')}
                      aria-label={t('shared.generic.assessment')}
                    >
                      <FontAwesomeIcon
                        icon={faClipboardCheck}
                        className="text-uzh-red-100 mb-0.5 w-3.5"
                      />
                    </span>
                  )}
                  {quiz.isPinProtected && (
                    <span
                      className="flex items-center"
                      title={t('shared.generic.pinProtected')}
                      aria-label={t('shared.generic.pinProtected')}
                    >
                      <FontAwesomeIcon
                        icon={faLock}
                        className="text-primary-100 mb-0.5 w-3.5"
                      />
                    </span>
                  )}
                </div>
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
    if (typeof ctx.params?.shortname !== 'string') {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
          statusCode: 302,
        },
      }
    }

    const trpcClient = createTRPCSSRClient(ctx)
    const result = await trpcClient.participant.shortnameQuizzes.query({
      shortname: ctx.params.shortname,
    })

    // if there is no result (e.g., the shortname is not valid)
    if (!result?.shortnameQuizzes) {
      return {
        props: {
          isInactive: true,
          shortname: ctx.params.shortname,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    // if only a single live quiz is running, redirect directly to the corresponding quiz page
    // or if linkTo is set, redirect to the specified link
    if (result.shortnameQuizzes.length === 1) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/session/${result.shortnameQuizzes[0].id}`,
          permanent: false,
        },
      }
    }

    const { participantToken, cookiesAvailable } = await getParticipantToken({
      ctx,
    })

    if (participantToken) {
      return {
        props: {
          participantToken,
          cookiesAvailable,
          shortname: ctx.params.shortname,
          initialShortnameQuizData: result,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    return {
      props: {
        shortname: ctx.params.shortname,
        initialShortnameQuizData: result,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
  } catch (error) {
    console.error('Error in getServerSideProps on join page:', error)

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
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/join/${ctx.params?.shortname}`)}`,
        permanent: false,
      },
    }
  }
}

export default Join
