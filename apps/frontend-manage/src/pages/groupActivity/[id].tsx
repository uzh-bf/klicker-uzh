import { GetServerSidePropsContext } from 'next'

import { useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import { GetGroupActivityDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'

function GroupActivityOverview() {
  const router = useRouter()

  const { data, loading, error } = useQuery(GetGroupActivityDocument, {
    variables: { id: router.query.id as string },
    skip: !router.query.id,
  })

  console.log(data)

  return (
    <Layout>
      <div>
        <h1 className="text-xl font-bold">Group Activity</h1>
        <h2 className="text-lg font-bold">{data?.groupActivity?.name}</h2>
        <div>
          {data?.groupActivity?.instances?.map((instance) => (
            <div key={instance.id}>
              <h3>{instance.id}</h3>
              <p>{instance.decisionsSubmittedAt}</p>
              <p>{JSON.stringify(instance.decisions)}</p>
              <p>{JSON.stringify(instance.results)}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}

export async function getServerSideProps({
  locale,
}: GetServerSidePropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default GroupActivityOverview
