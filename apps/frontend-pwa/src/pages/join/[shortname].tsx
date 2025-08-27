import { useQuery } from '@apollo/client'
import { faChalkboardUser } from '@fortawesome/free-solid-svg-icons'
import { GetShortnameQuizzesDocument } from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
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
        <div className="flex flex-col gap-1.5">
          {data.shortnameQuizzes.map((quiz) => (
            <LinkButton
              key={quiz.id}
              icon={faChalkboardUser}
              href={`/session/${quiz.id}`}
              data={{ cy: `join-live-quiz-${quiz.name}` }}
              className={{ root: 'gap-1 text-lg', icon: 'h-5 w-5' }}
            >
              {quiz.displayName}{' '}
              {quiz.course && `in ${quiz.course?.displayName}`}
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

    // redirect to lti error page with redirect back to this page
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/ltiError?redirectTo=${process.env.NEXT_PUBLIC_PWA_URL}/${ctx.locale}/join/${ctx.params?.shortname}`,
        permanent: false,
      },
    }
  }
}

export default Join
