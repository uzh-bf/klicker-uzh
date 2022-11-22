import { LeaderboardEntry } from '@klicker-uzh/graphql/dist/ops'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { ParticipantOther } from './Participant'

function SinglePodium({
  username,
  avatar,
  score,
  className,
}: {
  username?: string
  avatar?: string
  score?: number
  className?: string
}): React.ReactElement {
  return (
    <div
      className={twMerge(
        'flex-1 md:border-b-4 bg-slate-300 md:border-slate-500 rounded-t-md text-sm',
        className
      )}
    >
      <ParticipantOther
        className="bg-white shadow border-slate-400"
        pseudonym={username}
        avatar={avatar}
        points={score ?? 0}
        withAvatar={!!avatar}
      />
    </div>
  )
}

interface PodiumProps {
  leaderboard: LeaderboardEntry[]
  className?: {
    root?: string
    single?: string
  }
}
export function Podium({ leaderboard, className }: PodiumProps) {
  const { rank1, rank2, rank3 } = useMemo(() => {
    if (!leaderboard) return {}
    return {
      rank1: leaderboard.length >= 1 ? leaderboard[0] : undefined,
      rank2: leaderboard.length >= 2 ? leaderboard[1] : undefined,
      rank3: leaderboard.length >= 3 ? leaderboard[2] : undefined,
    }
  }, [leaderboard])

  return (
    <div className="flex flex-col gap-4 md:items-end md:flex-row">
      <SinglePodium
        className={twMerge('order-2 h-[70px] md:order-1', className?.single)}
        username={rank2?.username}
        avatar={rank2?.avatar as string}
        score={rank2?.score}
      />

      <SinglePodium
        className={twMerge('order-1 h-[80px] md:order-2', className?.single)}
        username={rank1?.username}
        avatar={rank1?.avatar as string}
        score={rank1?.score}
      />

      <SinglePodium
        className={twMerge('order-3 h-[60px]', className?.single)}
        username={rank3?.username}
        avatar={rank3?.avatar as string}
        score={rank3?.score}
      />
    </div>
  )
}
