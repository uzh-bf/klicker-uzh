import { initializeApollo, addApolloState } from "@lib/apollo"
import { GetStaticPaths, GetStaticProps } from "next"
import { GetRunningSessionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { useQuery } from "@apollo/client"
import Link from "next/link"
import { Button } from "@uzh-bf/design-system"

interface Props {
  isInactive: boolean
  shortname: string
}

function Join({ isInactive, shortname }: Props) {
  const { data } = useQuery(GetRunningSessionsDocument, {
    variables: { shortname },
    skip: isInactive
  })

  if (isInactive || !data || !data.runningSessions?.length || data.runningSessions.length === 0) {
    return <div>Keine Sessions aktiv.</div>
  }

  return <div className="max-w-6xl p-4 m-auto mt-4 border rounded">
    {data.runningSessions.map((session) => (
      <div className="" key={session.id}>
        <Link href={`/session/${session.id}`}>
          <Button>{session.displayName}</Button>
          </Link>
      </div>
    ))}
  </div>
}

export const getStaticProps: GetStaticProps = async (ctx) => {
  const apolloClient = initializeApollo()

  if (typeof ctx.params?.shortname !== 'string') {
    return {
      redirect: {
        destination: `/404`,
        permanent: false,
      },
    }
  }

  const result = await apolloClient.query({
    query: GetRunningSessionsDocument,
    variables: {
      shortname: ctx.params.shortname,
    },
  })

  // if there is no result (e.g., the shortname is not valid)
  if (!result) {
    return {
      props: {
        isInactive: true
      }
    }
  }

  // if only a single session is running, redirect directly to the corresponding session page
  if (result.data.runningSessions?.length === 1) {
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
    revalidate: 5,
  })
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking'
  }
}

export default Join
