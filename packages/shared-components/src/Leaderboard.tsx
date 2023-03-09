import { LeaderboardEntry, Participant } from '@klicker-uzh/graphql/dist/ops'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { ParticipantOther, ParticipantSelf } from './Participant'
import { Podium } from './Podium'

interface LeaderboardProps {
  leaderboard: any[]
  activeParticipation?: boolean
  onJoin?: () => void
  onLeave?: () => void
  onParticipantClick?: (participantId: string, isSelf: boolean) => void
  participant?: Participant
  hidePodium?: boolean
  hideAvatars?: boolean
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
  onParticipantClick,
  participant,
  hidePodium,
  hideAvatars,
  className,
}: LeaderboardProps): React.ReactElement {
  const { top10, inTop10, selfEntry } = useMemo(
    () =>
      leaderboard.reduce(
        (acc, entry, ix) => {
          if (entry.participantId === participant?.id) {
            return {
              top10: [...acc.top10, entry],
              inTop10: ix <= 9,
              selfEntry: entry,
            }
          }

          if (ix <= 9) {
            return {
              top10: [...acc.top10, entry],
              inTop10: acc.inTop10,
            }
          }

          return acc
        },
        { top10: [], inTop10: false, selfEntry: undefined }
      ),
    [leaderboard, participant]
  )

  return (
    <div className={className?.root}>
      <div className="space-y-4">
        <div>
          {!hidePodium && (
            <Podium
              leaderboard={leaderboard?.slice(0, 3)}
              className={{
                root: className?.podium,
                single: className?.podiumSingle,
              }}
              simple={hideAvatars}
            />
          )}
        </div>
        <div className={twMerge('space-y-1', className?.list)}>
          {top10.map((entry: LeaderboardEntry) =>
            entry.isSelf === true && onLeave ? (
              <ParticipantSelf
                key={entry.id}
                isActive={activeParticipation ?? true}
                pseudonym={entry.username}
                avatar={entry.avatar ?? 'placeholder'}
                withAvatar={!hideAvatars}
                points={entry.score}
                rank={entry.rank}
                onJoinCourse={onJoin}
                onLeaveCourse={onLeave}
                onClick={
                  onParticipantClick
                    ? () => onParticipantClick(entry.participantId, true)
                    : undefined
                }
              />
            ) : (
              <ParticipantOther
                key={entry.id}
                rank={entry.rank}
                pseudonym={entry.username}
                avatar={entry.avatar ?? 'placeholder'}
                withAvatar={!hideAvatars}
                points={entry.score}
                onClick={
                  onParticipantClick
                    ? () => onParticipantClick(entry.participantId, false)
                    : undefined
                }
                className={className?.listItem}
              />
            )
          )}
        </div>
        {participant?.id && onJoin && onLeave && !activeParticipation && (
          <ParticipantSelf
            isActive={activeParticipation ?? false}
            pseudonym={participant.username}
            avatar={participant.avatar ?? 'placeholder'}
            withAvatar={!hideAvatars}
            points={selfEntry?.score}
            rank={selfEntry?.rank ?? '?'}
            onJoinCourse={onJoin}
            onLeaveCourse={onLeave}
            onClick={
              onParticipantClick
                ? () => onParticipantClick(participant.id, true)
                : undefined
            }
          />
        )}
      </div>
    </div>
  )
}

export default Leaderboard
