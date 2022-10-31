import React from 'react'
import { twMerge } from 'tailwind-merge'
import { ParticipantOther } from './Participant'
import { Podium } from './Podium'

interface LeaderboardProps {
  leaderboard: any[]
  className?: string
}

function Leaderboard({
  leaderboard,
  className,
}: LeaderboardProps): React.ReactElement {
  return (
    <div className={twMerge(className, '')}>
      <div className="space-y-4">
        <div>
          {leaderboard?.length > 0 && (
            <Podium leaderboard={leaderboard?.slice(0, 3)} />
          )}
        </div>
        <div className="space-y-1">
          {leaderboard?.slice(0, 10).map((entry) => (
            <ParticipantOther
              key={entry.id}
              rank={entry.rank}
              pseudonym={entry.username}
              avatar={entry.avatar ?? 'placeholder'}
              points={entry.score}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Leaderboard
