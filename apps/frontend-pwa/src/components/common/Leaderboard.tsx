import { useQuery } from '@apollo/client'
import { GetSessionLeaderboardDocument } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface LeaderboardProps {
  sessionId: string
  className?: string
}

function Leaderboard({
  sessionId,
  className,
}: LeaderboardProps): React.ReactElement {
  const { data, loading } = useQuery(GetSessionLeaderboardDocument, {
    variables: { sessionId },
    fetchPolicy: 'network-only',
  })

  if (loading || !data) {
    return <div>loading</div>
  }

  return (
    <div className={twMerge(className, '')}>
      <H2>Leaderboard</H2>
      <div>
        {data.sessionLeaderboard?.map((entry) => (
          <div className="flex flex-row justify-between" key={entry.id}>
            <div>{entry.username}</div>
            <div>{entry.score}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Leaderboard
