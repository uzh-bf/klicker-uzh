import Image from 'next/image'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import type { LeaderboardCombinedEntry } from './Leaderboard'
import { ParticipantOther } from './Participant'

const rankHeights: Record<number, string> = {
  1: 'order-1 h-[80px] md:order-2',
  2: 'order-2 h-[70px] md:order-1',
  3: 'order-3 h-[60px]',
}

interface SinglePodiumProps {
  username?: string
  avatar?: string
  score?: number
  rank: number
  noEntries?: boolean
  className?: string
  imgSrc?: any
}

function SinglePodium({
  username,
  avatar,
  score,
  rank,
  noEntries,
  className,
  imgSrc,
}: SinglePodiumProps): React.ReactElement {
  if (!imgSrc) {
    return (
      <div
        className={twMerge(
          'flex-1 rounded-t-md bg-slate-300 text-sm md:border-b-4 md:border-slate-500',
          rankHeights[rank],
          className
        )}
      >
        <ParticipantOther
          className="border-slate-400 bg-white shadow"
          pseudonym={username}
          avatar={avatar}
          points={score ?? 0}
          withAvatar={!!avatar}
        />
      </div>
    )
  }

  return (
    <div className="relative text-center">
      <Image
        src={imgSrc}
        alt={`Podium position ${rank}`}
        width={300}
        height={300}
        className="opacity-80"
      />

      {!noEntries && (
        <Image
          src={
            avatar
              ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${avatar}.svg`
              : '/user-solid.svg'
          }
          alt="User avatar"
          height={50}
          width={50}
          className={twMerge(
            'absolute rounded-full bg-opacity-60',
            avatar ? 'bg-white' : 'p-2'
          )}
          style={{
            top: twMerge(
              rank === 1 && '17%',
              rank === 2 && '26%',
              rank === 3 && '29%'
            ),
            left: '33%',
            width: '35%',
          }}
        />
      )}

      <div className="absolute bottom-0 mx-auto w-full text-xs text-slate-700 lg:text-lg">
        {username}
      </div>
    </div>
  )
}

interface PodiumProps {
  leaderboard: Partial<LeaderboardCombinedEntry>[]
  className?: {
    root?: string
    single?: string
  }
  imgSrc?: {
    rank1: any
    rank2: any
    rank3: any
  }
}
export function Podium({ leaderboard, className, imgSrc }: PodiumProps) {
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
    <div className={twMerge('flex flex-row items-end gap-4')}>
      <SinglePodium
        rank={2}
        username={rank2?.username}
        avatar={rank2?.avatar as string}
        score={rank2?.score}
        noEntries={emptyLeaderboard}
        className={className?.single}
        imgSrc={imgSrc?.rank2}
      />

      <SinglePodium
        rank={1}
        username={rank1?.username}
        avatar={rank1?.avatar as string}
        score={rank1?.score}
        noEntries={emptyLeaderboard}
        className={className?.single}
        imgSrc={imgSrc?.rank1}
      />

      <SinglePodium
        rank={3}
        username={rank3?.username}
        avatar={rank3?.avatar as string}
        score={rank3?.score}
        noEntries={emptyLeaderboard}
        className={className?.single}
        imgSrc={imgSrc?.rank3}
      />
    </div>
  )
}
