import { useQuery } from '@apollo/client'
import { GetRunningSessionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { Button } from '@uzh-bf/design-system'
import { GetServerSideProps } from 'next'
import Link from 'next/link'

interface Props {
  isInactive: boolean
  shortname: string
}

function Join({ isInactive, shortname }: Props) {
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
    return <div>Keine Sessions aktiv.</div>
  }

  return (
    <div className="max-w-6xl p-4 mx-auto mt-4 border rounded">
      {data.runningSessions.map((session) => (
        <div className="" key={session.id}>
          <Link href={`/session/${session.id}`} legacyBehavior>
            <Button>{session.displayName}</Button>
          </Link>
        </div>
      ))}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
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

  const { participantToken, participant } = await getParticipantToken({
    apolloClient,
    ctx,
  })

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

  return addApolloState(apolloClient, {
    props: {
      shortname: ctx.params.shortname,
    },
  })
}

export default Join
