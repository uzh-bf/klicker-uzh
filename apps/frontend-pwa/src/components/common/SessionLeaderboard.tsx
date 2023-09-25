import { useQuery } from '@apollo/client'
import {
  GetSessionLeaderboardDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, UserNotification } from '@uzh-bf/design-system'
import localforage from 'localforage'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import Leaderboard from '@klicker-uzh/shared-components/src/Leaderboard'
import Rank1Img from '../../../public/rank1.svg'
import Rank2Img from '../../../public/rank2.svg'
import Rank3Img from '../../../public/rank3.svg'

interface SessionLeaderboardProps {
  sessionId: string
  className?: string
}

type BlockResult = {
  score: number
  rank: number
} | null

function SessionLeaderboard({
  sessionId,
  className,
}: SessionLeaderboardProps): React.ReactElement {
  const t = useTranslations()

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

  const [blockDelta, setBlockDelta] = useState<BlockResult>(null)

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

        if (selfEntry.lastBlockOrder > 0) {
          try {
            const prevStoredEntry: BlockResult = await localforage.getItem(
              `${selfEntry.participantId}-score-block${
                selfEntry.lastBlockOrder - 1
              }`
            )
            if (!prevStoredEntry) return

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
  }, [data, selfData?.self?.id])

  if (loading || !data) {
    return <Loader />
  }

  return (
    <div className={twMerge('space-y-4', className)}>
      <H2>{t('shared.leaderboard.sessionTitle')}</H2>
      <div>
        {data.sessionLeaderboard?.length &&
        data.sessionLeaderboard.length > 0 ? (
          <Leaderboard
            leaderboard={data.sessionLeaderboard ?? []}
            participant={selfData?.self}
            podiumImgSrc={{
              rank1: Rank1Img,
              rank2: Rank2Img,
              rank3: Rank3Img,
            }}
          />
        ) : (
          <UserNotification
            type="info"
            message={t('shared.leaderboard.noPointsCollected')}
          />
        )}
      </div>
      {blockDelta && (
        <div className="flex flex-row gap-4 text-xl">
          <div>
            &Delta; {t('shared.leaderboard.ranks')}:{' '}
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
            &Delta; {t('shared.leaderboard.points')}:{' '}
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
  )
}

export default SessionLeaderboard
