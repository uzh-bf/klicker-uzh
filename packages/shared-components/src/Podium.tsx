import { LeaderboardEntry } from '@klicker-uzh/graphql/dist/ops'
import Image from 'next/image'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { ParticipantOther } from './Participant'

const rankHeights: Record<number, string> = {
  1: 'order-1 h-[80px] md:order-2',
  2: 'order-2 h-[70px] md:order-1',
  3: 'order-3 h-[60px]',
}

interface SinglePodiumProps {
  username: string
  avatar?: string
  score?: number
  rank: number
  noEntries?: boolean
  simple?: boolean
  className?: string
}

function SinglePodium({
  username,
  avatar,
  score,
  rank,
  noEntries,
  simple,
  className,
}: SinglePodiumProps): React.ReactElement {
  if (simple) {
    return (
      <div
        className={twMerge(
          'flex-1 md:border-b-4 bg-slate-300 md:border-slate-500 rounded-t-md text-sm',
          rankHeights[rank],
          className
        )}
      >
        <ParticipantOther
          className="bg-white shadow border-slate-400"
          pseudonym={username}
          avatar={avatar}
          points={score ?? 0}
          withAvatar={!!avatar}
        />{' '}
      </div>
    )
  }

  const image = useMemo(() => {
    if (rank === 1) return '/first.svg'
    if (rank === 2) return '/second.svg'
    if (rank === 3) return '/third.svg'
    return '/first.svg'
  }, [rank])

  return (
    <div className="relative text-center">
      <Image
        src={image}
        alt={`Podium position ${rank}`}
        width={300}
        height={300}
        className="relative"
      />
      {!noEntries && (
        <Image
          src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
            avatar || 'placeholder'
          }.svg`}
          alt="User avatar"
          height={25}
          width={30}
          className="absolute"
          style={{
            top: twMerge(
              rank === 1 && '26%',
              rank === 2 && '23%',
              rank === 3 && '30%'
            ),
            left: '42.5%',
          }}
        />
      )}

      <div className="w-full mx-auto italic">{username}</div>
    </div>
  )
}

interface PodiumProps {
  leaderboard: Partial<LeaderboardEntry>[]
  simple?: boolean
  className?: {
    root?: string
    single?: string
  }
}
export function Podium({
  leaderboard,
  simple = false,
  className,
}: PodiumProps) {
  const { rank1, rank2, rank3 } = useMemo(() => {
    if (!leaderboard) return {}
    return {
      rank1: leaderboard.length >= 1 ? leaderboard[0] : undefined,
      rank2: leaderboard.length >= 2 ? leaderboard[1] : undefined,
      rank3: leaderboard.length >= 3 ? leaderboard[2] : undefined,
    }
  }, [leaderboard])

  const emptyLeaderboard = useMemo(() => {
    return (
      typeof rank1?.avatar === 'undefined' &&
      typeof rank2?.avatar === 'undefined' &&
      typeof rank3?.avatar === 'undefined'
    )
  }, [rank1, rank2, rank3])

  return (
    <div className={twMerge('flex flex-row items-end', simple && 'gap-4')}>
      <SinglePodium
        rank={2}
        username={rank2?.username || ''}
        avatar={rank2?.avatar as string}
        score={rank2?.score}
        noEntries={emptyLeaderboard}
        simple={simple}
        className={className?.single}
      />

      <SinglePodium
        rank={1}
        username={rank1?.username || ''}
        avatar={rank1?.avatar as string}
        score={rank1?.score}
        noEntries={emptyLeaderboard}
        simple={simple}
        className={className?.single}
      />

      <SinglePodium
        rank={3}
        username={rank3?.username || ''}
        avatar={rank3?.avatar as string}
        score={rank3?.score}
        noEntries={emptyLeaderboard}
        simple={simple}
        className={className?.single}
      />
    </div>
  )
}
