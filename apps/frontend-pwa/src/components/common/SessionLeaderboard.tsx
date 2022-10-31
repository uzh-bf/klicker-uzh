import { useQuery } from '@apollo/client'
import { ParticipantOther } from '@components/Participant'
import { Podium } from '@components/Podium'
import {
  GetSessionLeaderboardDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import localforage from 'localforage'
import React, { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface LocalLeaderboardEntry {
  avatar?: string
  username: string
  score: number
  lastBlockOrder: number
}

interface LeaderboardProps {
  sessionId: string
  className?: string
}

function Leaderboard({
  sessionId,
  className,
}: LeaderboardProps): React.ReactElement {
  const { data: selfData } = useQuery(SelfDocument, {
    fetchPolicy: 'cache-only',
  })

  const { data, loading } = useQuery(GetSessionLeaderboardDocument, {
    variables: { sessionId },
    // use network-only to trigger a refetch once the component is displayed
    // TODO: replace this by a send of the leaderboard within the subscription
    // TODO: otherwise, this could overload the server if 1000 simultaneous users are on the leaderboard
    fetchPolicy: 'network-only',
  })

  const [currentEntry, setCurrentEntry] = useState({
    participantId: '',
    score: 0,
    rank: 0,
    lastBlockOrder: 0,
  })
  const [previousEntry, setPreviousEntry] = useState({
    participantId: '',
    score: 0,
    rank: 0,
    lastBlockOrder: 0,
  })
  const [blockDelta, setBlockDelta] = useState(null)

  // save the current leaderboard to local storage
  useEffect(() => {
    const asyncFunc = async () => {
      const leaderboard = data?.sessionLeaderboard

      const selfEntry = leaderboard?.find(
        (entry) => entry.participantId === selfData?.self?.id
      )

      if (selfEntry) {
        localforage.setItem(
          `${selfEntry.participantId}-score-block${selfEntry.lastBlockOrder}`,
          selfEntry
        )
        setCurrentEntry(selfEntry)

        if (selfEntry.lastBlockOrder > 0) {
          try {
            const prevStoredEntry = await localforage.getItem(
              `${selfEntry.participantId}-score-block${
                selfEntry.lastBlockOrder - 1
              }`
            )
            if (!prevStoredEntry) return
            setPreviousEntry(prevStoredEntry)

            setBlockDelta({
              score: selfEntry.score - prevStoredEntry.score,
              rank: selfEntry.rank - prevStoredEntry.rank,
            })
          } catch (error) {
            console.warn(error)
          }
        }
      }
    }

    asyncFunc()
  }, [data])

  if (loading || !data) {
    return <div>Loading...</div>
  }

  return (
    <div className={twMerge(className, '')}>
      <div className="space-y-4">
        <div>
          {data.sessionLeaderboard?.length > 0 && (
            <Podium leaderboard={data.sessionLeaderboard?.slice(0, 3)} />
          )}
        </div>
        <div className="space-y-1">
          {data.sessionLeaderboard?.slice(0, 10).map((entry) => (
            <ParticipantOther
              key={entry.id}
              rank={entry.rank}
              isHighlighted={entry.participantId === selfData?.self?.id}
              pseudonym={entry.username}
              avatar={entry.avatar ?? 'placeholder'}
              points={entry.score}
            />
          ))}
        </div>
        {blockDelta && (
          <div className="flex flex-row gap-4 text-xl">
            <div>
              &Delta; Ränge:{' '}
              <span
                className={twMerge(
                  blockDelta.rank > 0 && 'text-green-700',
                  blockDelta.rank < 0 && 'text-red-700'
                )}
              >
                {blockDelta.rank > 0 && '+'}
                {blockDelta.rank}
              </span>
            </div>
            <div>
              &Delta; Punkte:{' '}
              <span
                className={twMerge(
                  blockDelta.score > 0 && 'text-green-700',
                  blockDelta.score < 0 && 'text-red-700'
                )}
              >
                {blockDelta.score > 0 && '+'}
                {blockDelta.score}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Leaderboard
