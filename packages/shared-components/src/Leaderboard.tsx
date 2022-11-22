import React from 'react'
import { twMerge } from 'tailwind-merge'
import { ParticipantOther, ParticipantSelf } from './Participant'
import { Podium } from './Podium'

// TODO: eliminate participantId and replace it by participant.id
interface LeaderboardProps {
  leaderboard: any[]
  activeParticipation?: boolean
  onJoin?: () => void
  onLeave?: () => void
  participant?: any // TODO: typing
  hidePodium?: boolean
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
  activeParticipation,
  onJoin,
  onLeave,
  participant,
  hidePodium,
  className,
}: LeaderboardProps): React.ReactElement {
  return (
    <div className={className?.root}>
      <div className="space-y-4">
        <div>
          {!hidePodium && leaderboard?.length > 0 && (
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
          {leaderboard
            ?.slice(0, 10)
            .map((entry) =>
              entry.isSelf === true && onLeave ? (
                <ParticipantSelf
                  key={entry.id}
                  isActive={activeParticipation || true}
                  pseudonym={entry.username}
                  avatar={entry.avatar ?? 'placeholder'}
                  points={entry.score}
                  rank={entry.rank}
                  onJoinCourse={onJoin}
                  onLeaveCourse={onLeave}
                />
              ) : (
                <ParticipantOther
                  key={entry.id}
                  rank={entry.rank}
                  pseudonym={entry.username}
                  avatar={entry.avatar ?? 'placeholder'}
                  points={entry.score}
                  className={className?.listItem}
                />
              )
            )}
        </div>
        {participant?.id && !activeParticipation && onJoin && onLeave && (
          <ParticipantSelf
            isActive={activeParticipation || false}
            pseudonym={participant.username}
            avatar={participant.avatar ?? 'placeholder'}
            points={participant.score}
            rank="?"
            onJoinCourse={onJoin}
            onLeaveCourse={onLeave}
          />
        )}
      </div>
    </div>
  )
}

export default Leaderboard
