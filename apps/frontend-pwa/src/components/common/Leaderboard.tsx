import { useQuery } from '@apollo/client'
import { GetSessionLeaderboardDocument } from '@klicker-uzh/graphql/dist/ops'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface LeaderboardProps {
  sessionId: string
  className?: string
}

function Leaderboard({ sessionId, className }: LeaderboardProps): React.ReactElement {
  const { data, loading } = useQuery(GetSessionLeaderboardDocument, {
    variables: { sessionId }
  })

  if (loading || !data) {
    return <div>loading</div>
  }

  console.warn(data)

  return <div className={twMerge(className, '')}>Leaderboard</div>
}

export default Leaderboard
