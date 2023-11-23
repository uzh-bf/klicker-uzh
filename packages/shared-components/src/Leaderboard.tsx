import { LeaderboardEntry, Participant } from '@klicker-uzh/graphql/dist/ops'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { ParticipantOther, ParticipantSelf } from './Participant'
import { Podium } from './Podium'

interface LeaderboardProps {
  leaderboard: LeaderboardEntry[]
  onJoin?: () => void
  onLeave?: () => void
  onParticipantClick?: (participantId: string, isSelf: boolean) => void
  participant?: Participant | null
  hidePodium?: boolean
  hideAvatars?: boolean
  className?: {
    root?: string
    podium?: string
    podiumSingle?: string
    list?: string
    listItem?: string
  }
  podiumImgSrc?: {
    rank1: any
    rank2: any
    rank3: any
  }
}

function Leaderboard({
  leaderboard,
  onJoin,
  onLeave,
  onParticipantClick,
  participant,
  hidePodium,
  hideAvatars,
  className,
  podiumImgSrc,
}: LeaderboardProps): React.ReactElement {
  const { top10AndSelf, inTop10, selfEntry } = useMemo(
    () =>
      leaderboard.reduce<{
        top10AndSelf: LeaderboardEntry[]
        inTop10: boolean
        selfEntry?: LeaderboardEntry
      }>(
        (acc, entry, ix) => {
          if (entry.participantId === participant?.id) {
            return {
              top10AndSelf: [...acc.top10AndSelf, { ...entry, isSelf: true }],
              inTop10: ix <= 9,
              selfEntry: entry,
            }
          }

          if (ix <= 9) {
            return {
              top10AndSelf: [...acc.top10AndSelf, entry],
              inTop10: acc.inTop10,
            }
          }

          return acc
        },
        { top10AndSelf: [], inTop10: false, selfEntry: undefined }
      ),
    [leaderboard, participant]
  )

  return (
    <div className={twMerge('space-y-4', className?.root)}>
      {!hidePodium && (
        <Podium
          leaderboard={leaderboard?.slice(0, 3)}
          className={{
            root: className?.podium,
            single: className?.podiumSingle,
          }}
          imgSrc={podiumImgSrc}
        />
      )}
      <div className={twMerge('space-y-1', className?.list)}>
        {top10AndSelf
          .filter((entry: LeaderboardEntry) => entry.rank <= 10)
          .map((entry: LeaderboardEntry) =>
            entry.isSelf === true ? (
              <ParticipantSelf
                key={entry.id}
                isActive
                pseudonym={entry.username}
                avatar={entry.avatar}
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
                avatar={entry.avatar}
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
        {!inTop10 && selfEntry && (
          <ParticipantSelf
            key={selfEntry.id}
            isActive
            pseudonym={selfEntry.username}
            avatar={selfEntry.avatar}
            withAvatar={!hideAvatars}
            points={selfEntry.score}
            rank={selfEntry.rank}
            onJoinCourse={onJoin}
            onLeaveCourse={onLeave}
          />
        )}
      </div>
    </div>
  )
}

export default Leaderboard
