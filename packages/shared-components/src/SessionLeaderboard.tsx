import React from 'react'
import { twMerge } from 'tailwind-merge'
import { ParticipantOther } from './Participant'
import { Podium } from './Podium'

interface LeaderboardProps {
  leaderboard: any[]
  className?: {
    root?: string
    podium?: string
    podiumSingle?: string
    list?: string
    listItem?: string
  }
}

function Leaderboard({
  leaderboard,
  className,
}: LeaderboardProps): React.ReactElement {
  return (
    <div className={className?.root}>
      <div className="space-y-4">
        <div>
          {leaderboard?.length > 0 && (
            <Podium
              leaderboard={leaderboard?.slice(0, 3)}
              className={{
                root: className?.podium,
                single: className?.podiumSingle,
              }}
            />
          )}
        </div>
        <div className={twMerge('space-y-1', className?.list)}>
          {leaderboard?.slice(0, 10).map((entry) => (
            <ParticipantOther
              key={entry.id}
              rank={entry.rank}
              pseudonym={entry.username}
              avatar={entry.avatar ?? 'placeholder'}
              points={entry.score}
              className={className?.listItem}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Leaderboard
