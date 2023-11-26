import { Participant } from '@klicker-uzh/graphql/dist/ops'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { ParticipantOther, ParticipantSelf } from './Participant'
import { Podium } from './Podium'

export interface LeaderboardCombinedEntry {
  id: string | number
  participantId?: string
  isMember?: boolean
  username: string
  avatar?: string | null
  score: number
  rank: number
  isSelf?: boolean | null
}

interface LeaderboardProps {
  leaderboard: LeaderboardCombinedEntry[]
  onJoin?: () => void
  onLeave?: () => void
  onParticipantClick?: (participantId: string, isSelf: boolean) => void
  participant?: Partial<Participant> | null
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
        top10AndSelf: LeaderboardCombinedEntry[]
        inTop10: boolean
        selfEntry?: LeaderboardCombinedEntry
      }>(
        (acc, entry, ix) => {
          if (
            entry.isMember ||
            (typeof entry.participantId !== 'undefined' &&
              entry.participantId === participant?.id)
          ) {
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
          .filter((entry: LeaderboardCombinedEntry) => entry.rank <= 10)
          .map((entry: LeaderboardCombinedEntry) =>
            entry.isSelf === true ? (
              <ParticipantSelf
                key={entry.id}
                isActive={entry.isSelf}
                pseudonym={entry.username}
                avatar={entry.avatar}
                withAvatar={!hideAvatars}
                points={entry.score}
                rank={entry.rank}
                onJoinCourse={onJoin}
                onLeaveCourse={onLeave}
                onClick={
                  onParticipantClick &&
                  typeof entry.participantId !== 'undefined'
                    ? () => onParticipantClick(entry.participantId!, true)
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
                  onParticipantClick &&
                  typeof entry.participantId !== 'undefined'
                    ? () => onParticipantClick(entry.participantId!, false)
                    : undefined
                }
                className={className?.listItem}
              />
            )
          )}
        {!inTop10 && selfEntry && (
          <ParticipantSelf
            key={selfEntry.id}
            isActive={selfEntry.isSelf ?? false}
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
