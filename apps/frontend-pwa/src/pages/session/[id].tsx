// TODO: remove solution data from getSession query (in service as for learning element)

import { GetSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { GetServerSideProps } from 'next'
// import { useRouter } from 'next/router'
// import { useQuery } from '@apollo/client'

import { initializeApollo } from '@lib/apollo'

function Index({ session }: any) {
  // const router = useRouter()

  // const { loading, error, data } = useQuery(GetSessionDocument, {
  //   variables: {
  //     id: router.query.id as string,
  //   },
  // })

  // if (loading || !data) return <p>Loading...</p>
  // if (error) return <p>Oh no... {error.message}</p>

  // console.log(data)

  console.log(session)

  return <div className="p-4">{session?.id}</div>
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const apolloClient = initializeApollo()

  const result = await apolloClient.query({
    query: GetSessionDocument,
    variables: {
      id: 'cfa0ca6e-b22a-4974-99fa-245a33a939ce' as string,
    },
  })

  return { props: { session: result.data?.session } }
}

export default Index
