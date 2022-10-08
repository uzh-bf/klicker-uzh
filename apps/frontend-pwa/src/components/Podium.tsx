import { LeaderboardEntry } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'
import { ParticipantOther } from './Participant'

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
      <div className="flex-1 order-2 h-28 md:border-b-2 md:order-1 bg-uzh-grey-20 md:border-uzh-blue-100">
        <div className="text-2xl font-bold bg-white md:text-center text-uzh-red-100">
          2. {rank2?.isSelf && 'bist du!'}
        </div>
        <ParticipantOther
          className="bg-white shadow outline-uzh-red-100"
          pseudonym={rank2?.username ?? 'Frei'}
          avatar={rank2?.avatar}
          points={rank2?.score ?? 0}
        />
      </div>

      <div className="flex-1 order-1 h-32 md:border-b-2 md:order-2 bg-uzh-grey-20 md:border-uzh-blue-100">
        <div className="text-2xl font-bold bg-white md:text-center text-uzh-red-100">
          1. {rank1?.isSelf && 'bist du!'}
        </div>
        <ParticipantOther
          className="bg-white shadow outline-uzh-red-100"
          pseudonym={rank1?.username ?? 'Frei'}
          avatar={rank1?.avatar}
          points={rank1?.score ?? 0}
        />
      </div>

      <div className="flex-1 order-3 h-24 md:border-b-2 bg-uzh-grey-20 md:border-uzh-blue-100">
        <div className="text-2xl font-bold bg-white md:text-center text-uzh-red-100">
          3. {rank3?.isSelf && 'bist du!'}
        </div>
        <ParticipantOther
          className="bg-white shadow outline-uzh-red-100"
          pseudonym={rank3?.username ?? 'Frei'}
          avatar={rank3?.avatar}
          points={rank3?.score ?? 0}
        />
      </div>
    </div>
  )
}
