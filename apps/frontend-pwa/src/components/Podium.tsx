import { LeaderboardEntry } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { ParticipantOther } from './Participant'

function SinglePodium({ number, username, avatar, score, isSelf, className }) {
  return (
    <div
      className={twMerge(
        'flex-1 md:border-b-4 bg-uzh-grey-20 md:border-slate-600',
        className
      )}
    >
      <div className="text-xl bg-white md:text-center text-uzh-red-100">
        {number}. {isSelf && 'bist du!'}
      </div>

      <ParticipantOther
        className="bg-white shadow outline-slate-700"
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
}
export function Podium({ leaderboard }: PodiumProps) {
  const { rank1, rank2, rank3 } = useMemo(() => {
    if (!leaderboard) return {}
    return {
      rank1: leaderboard.length >= 1 && leaderboard[0],
      rank2: leaderboard.length >= 2 && leaderboard[1],
      rank3: leaderboard.length >= 3 && leaderboard[2],
    }
  }, [leaderboard])

  return (
    <div className="flex flex-col gap-4 md:items-end md:flex-row">
      <SinglePodium
        className="order-2 h-[90px] md:order-1"
        isSelf={rank2?.isSelf}
        username={rank2?.username}
        avatar={rank2?.avatar}
        score={rank2?.score}
        number={2}
      />

      <SinglePodium
        className="order-1 h-[100px] md:order-2"
        isSelf={rank1?.isSelf}
        username={rank1?.username}
        avatar={rank1?.avatar}
        score={rank1?.score}
        number={1}
      />

      <SinglePodium
        className="order-3 h-[80px]"
        isSelf={rank3?.isSelf}
        username={rank3?.username}
        avatar={rank3?.avatar}
        score={rank3?.score}
        number={3}
      />
    </div>
  )
}
