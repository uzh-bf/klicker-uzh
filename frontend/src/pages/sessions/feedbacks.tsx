import { useState } from 'react'
import { useQuery } from '@apollo/client'
import Head from 'next/head'
import { Icon, Dropdown } from 'semantic-ui-react'
import dayjs from 'dayjs'
import PinnedFeedbacksQuery from '../../graphql/queries/PinnedFeedbacksQuery.graphql'

function Feedbacks() {
  const [sortBy, setSortBy] = useState('upvotes')

  const { data, loading, error } = useQuery(PinnedFeedbacksQuery, {
    pollInterval: 10000,
  })

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  if (error) {
    return <div className="p-4">Error: {error.message}</div>
  }

  const { pinnedFeedbacks } = data

  return (
    <div className="p-4">
      <Head>
        <title>Feedbacks</title>
      </Head>
      <Dropdown
        selection
        options={[
          { text: 'Sort by Upvotes', value: 'upvotes' },
          { text: 'Sort by Recency', value: 'recency' },
        ]}
        value={sortBy}
        onChange={(_, { value }) => setSortBy(value as string)}
      />
      {pinnedFeedbacks?.length === 0 && (
        <div className="mt-4 flex items-center border border-solid bg-primary-10% border-primary text-2xl p-4">
          No feedbacks received or pinned yet...
        </div>
      )}
      {pinnedFeedbacks.map(({ id, content, createdAt, votes }) => (
        <div className="mt-4 flex items-center border border-solid bg-primary-10% border-primary" key={id}>
          <div className="flex-1 p-4">
            <p className="mb-0 text-2xl">{content}</p>
            <div className="flex flex-row mt-2 text-lg text-gray-500">
              <div>{dayjs(createdAt).format('DD.MM.YYYY HH:mm')}</div>
            </div>
          </div>
          <div className="flex flex-col justify-between flex-initial pr-4">
            <div className="text-3xl text-gray-500">
              {votes} <Icon name="thumbs up outline" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default Feedbacks
