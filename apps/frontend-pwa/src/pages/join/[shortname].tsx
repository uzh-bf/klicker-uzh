import { useQuery } from '@apollo/client'
import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetRunningSessionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { Button } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Layout from '../../components/Layout'

interface Props {
  isInactive: boolean
  shortname: string
  participantToken?: string
  cookiesAvailable?: boolean
}

function Join({
  isInactive,
  shortname,
  participantToken,
  cookiesAvailable,
}: Props) {
  const t = useTranslations()

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { data } = useQuery(GetRunningSessionsDocument, {
    variables: { shortname },
    skip: isInactive,
  })

  if (
    isInactive ||
    !data ||
    !data.runningSessions?.length ||
    data.runningSessions.length === 0
  ) {
    return <div>{t('pwa.general.noSessionsActive')}</div>
  }

  return (
    <Layout>
      <div className="w-full max-w-md p-4 mx-auto mt-4 border rounded">
        <div className="font-bold">
          {t.rich('pwa.general.activeSessionsBy', {
            i: (text) => <span className="italic">{text}</span>,
            name: shortname,
          })}
        </div>
        <div className="mt-2 space-y-1">
          {data.runningSessions.map((session) => (
            <div className="" key={session.id}>
              <Link href={`/session/${session.id}`}>
                <Button
                  fluid
                  className={{ root: 'justify-start gap-4' }}
                  data={{ cy: `join-session-${session.name}` }}
                >
                  <Button.Icon>
                    <FontAwesomeIcon icon={faExternalLink} />
                  </Button.Icon>
                  <Button.Label>
                    {session.displayName}{' '}
                    {session.course && `in ${session.course?.displayName}`}
                  </Button.Label>
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (typeof ctx.params?.shortname !== 'string') {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  const apolloClient = initializeApollo()

  const result = await apolloClient.query({
    query: GetRunningSessionsDocument,
    variables: {
      shortname: ctx.params.shortname,
    },
  })

  // if there is no result (e.g., the shortname is not valid)
  if (!result?.data?.runningSessions) {
    return {
      props: {
        isInactive: true,
      },
    }
  }

  // if only a single session is running, redirect directly to the corresponding session page
  // or if linkTo is set, redirect to the specified link
  if (result.data.runningSessions.length === 1) {
    if (result.data.runningSessions[0].linkTo) {
      return {
        redirect: {
          destination: result.data.runningSessions[0].linkTo,
          permanent: false,
        },
      }
    }

    return {
      redirect: {
        destination: `/session/${result.data.runningSessions[0].id}`,
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
}

export default Join
