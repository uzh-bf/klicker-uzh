import { LeaderboardEntry } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { ParticipantOther } from './Participant'

interface SinglePodiumProps {
  username: string
  avatar?: string
  score?: number
  className?: string
}

function SinglePodium({
  username,
  avatar,
  score,
  className,
}: SinglePodiumProps) {
  return (
    <div
      className={twMerge(
        'flex-1 md:border-b-4 bg-slate-300 md:border-slate-500 rounded-t-lg',
        className
      )}
    >
      <ParticipantOther
        className="text-sm bg-white shadow border-slate-400"
        pseudonym={username}
        avatar={avatar}
        withAvatar={!!avatar}
      />
    </div>
  )
}

interface PodiumProps {
  leaderboard: LeaderboardEntry[]
}

export function Podium({ leaderboard }: PodiumProps) {
  const { rank1, rank2, rank3 } = useMemo(() => {
    if (!leaderboard) return {}
    return {
      rank1: leaderboard.length >= 1 ? leaderboard[0] : undefined,
      rank2: leaderboard.length >= 2 ? leaderboard[1] : undefined,
      rank3: leaderboard.length >= 3 ? leaderboard[2] : undefined,
    }
  }, [leaderboard])

  return (
    <div className="flex flex-col gap-2 md:items-end md:flex-row">
      <SinglePodium
        className="order-2 h-[70px] md:order-1"
        username={rank2?.username || ''}
        avatar={String(rank2?.avatar)}
        score={rank2?.score}
      />

      <SinglePodium
        className="order-1 h-[80px] md:order-2"
        username={rank1?.username || ''}
        avatar={String(rank1?.avatar)}
        score={rank1?.score}
      />

      <SinglePodium
        className="order-3 h-[60px]"
        username={rank3?.username || ''}
        avatar={String(rank3?.avatar)}
        score={rank3?.score}
      />
    </div>
  )
}
