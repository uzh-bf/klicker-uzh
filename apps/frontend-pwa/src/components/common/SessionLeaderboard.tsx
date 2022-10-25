import { useQuery } from '@apollo/client'
import { GetSessionLeaderboardDocument } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import localforage from 'localforage'
import React, { useEffect, useState } from 'react'
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

  const [currentLeaderboard, setCurrentLeaderboard] = useState([
    { username: '', score: 0, lastBlockOrder: 0 },
  ])
  const [previousLeaderboard, setPreviousLeaderboard] = useState([
    { username: '', score: 0, lastBlockOrder: 0 },
  ])

  // save the current leaderboard to local storage
  useEffect(() => {
    const leaderboard: {
      username: string
      score: number
      lastBlockOrder: number
    }[] = data?.sessionLeaderboard?.map(
      ({
        username,
        score,
        lastBlockOrder,
      }: {
        username: string
        score: number
        lastBlockOrder: number
      }) => ({
        username,
        score,
        lastBlockOrder,
      })
    )

    const prevLeaderboard: {
      username: string
      score: number
      lastBlockOrder: number
    }[] = []

    leaderboard?.forEach(async (item) => {
      localforage.setItem(
        `${item.username}-score-block${item.lastBlockOrder}`,
        item.score
      )

      try {
        const prevScore = await localforage.getItem(
          `${item.username}-score-block${item.lastBlockOrder - 1}`
        )
        typeof prevScore === 'number' &&
          prevLeaderboard.push({
            username: item.username,
            score: prevScore,
            lastBlockOrder: item.lastBlockOrder,
          })

        setPreviousLeaderboard(prevLeaderboard)
      } catch (error) {
        console.warn(error)
      }
    })

    setCurrentLeaderboard(leaderboard)
  }, [data])

  // current and potentially previous leaderboard are given in the same format (users can also join at some point midsession with this approach)
  console.log('currentLeaderboard', currentLeaderboard)
  console.log('previousLeaderboard', previousLeaderboard)

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
