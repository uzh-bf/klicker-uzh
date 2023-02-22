import { Participant } from '@klicker-uzh/graphql/dist/ops'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { ParticipantOther, ParticipantSelf } from './Participant'
import { Podium } from './Podium'

interface LeaderboardProps {
  leaderboard: any[]
  activeParticipation?: boolean
  onJoin?: () => void
  onLeave?: () => void
  onParitcipantClick?: (participantId: string, isSelf: boolean) => void
  onProfileClick: (modalData: any) => void
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
  onParitcipantClick,
  onProfileClick,
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
            />
          )}
        </div>
        <div className={twMerge('space-y-1', className?.list)}>
          {top10.map((entry) =>
            entry.isSelf === true && onLeave ? (
              <div onClick={() => onProfileClick(entry)}>
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
                  onClick={() => true}
                  // onClick={
                  //   onParitcipantClick
                  //     ? () => onParitcipantClick(entry.participantId, true)
                  //     : undefined
                  // }
                />
              </div>
            ) : (
              <div onClick={() => onProfileClick(entry)}>
                <ParticipantOther
                  key={entry.id}
                  rank={entry.rank}
                  pseudonym={entry.username}
                  avatar={entry.avatar ?? 'placeholder'}
                  withAvatar={!hideAvatars}
                  points={entry.score}
                  onClick={() => true}
                  // onClick={
                  //   onParitcipantClick
                  //     ? () => onParitcipantClick(entry.participantId, false)
                  //     : undefined
                  // }
                  className={className?.listItem}
                />
              </div>
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
              onParitcipantClick
                ? () => onParitcipantClick(participant.id, true)
                : undefined
            }
          />
        )}
      </div>
    </div>
  )
}

export default Leaderboard
