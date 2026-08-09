import { useQuery } from '@apollo/client'
import {
  faClipboardCheck,
  faCrown,
  faLock,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetShortnameQuizzesDocument } from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
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
  participantToken,
  cookiesAvailable,
}: {
  isInactive: boolean
  shortname: string
  participantToken?: string
  cookiesAvailable?: boolean
}) {
  const t = useTranslations()

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { data } = useQuery(GetShortnameQuizzesDocument, {
    variables: { shortname },
    skip: isInactive,
  })

  if (
    isInactive ||
    !data ||
    !data.shortnameQuizzes?.length ||
    data.shortnameQuizzes.length === 0
  ) {
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
          {data.shortnameQuizzes.map((quiz) => (
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
                      role="img"
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
                      role="img"
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
                      role="img"
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

    const apolloClient = initializeApollo()
    const result = await apolloClient.query({
      query: GetShortnameQuizzesDocument,
      variables: {
        shortname: ctx.params.shortname,
      },
    })

    // if there is no result (e.g., the shortname is not valid)
    if (!result?.data?.shortnameQuizzes) {
      return {
        props: {
          isInactive: true,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    // if only a single live quiz is running, redirect directly to the corresponding quiz page
    // or if linkTo is set, redirect to the specified link
    if (result.data.shortnameQuizzes.length === 1) {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/session/${result.data.shortnameQuizzes[0].id}`,
          permanent: false,
        },
      }
    }

    const { participantToken, cookiesAvailable } = await getParticipantToken({
      apolloClient,
      ctx,
    })

    if (participantToken) {
      return {
        props: {
          participantToken,
          cookiesAvailable,
          shortname: ctx.params.shortname,
          messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
            .default,
        },
      }
    }

    return addApolloState(apolloClient, {
      props: {
        shortname: ctx.params.shortname,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    })
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
