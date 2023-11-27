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
  topKOnly?: number
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
  topKOnly,
}: LeaderboardProps): React.ReactElement {
  const { rankedEntriesAndSelf, inTopK, selfEntry } = useMemo(
    () =>
      leaderboard.reduce<{
        rankedEntriesAndSelf: LeaderboardCombinedEntry[]
        inTopK: boolean
        selfEntry?: LeaderboardCombinedEntry
      }>(
        (acc, entry, ix) => {
          if (
            entry.isMember ||
            (typeof entry.participantId !== 'undefined' &&
              entry.participantId === participant?.id)
          ) {
            return {
              rankedEntriesAndSelf: [
                ...acc.rankedEntriesAndSelf,
                { ...entry, isSelf: true },
              ],
              inTopK:
                typeof topKOnly !== 'undefined' ? ix <= topKOnly - 1 : false,
              selfEntry: entry,
            }
          }

          if (typeof topKOnly === 'undefined' || ix <= topKOnly - 1) {
            return {
              rankedEntriesAndSelf: [...acc.rankedEntriesAndSelf, entry],
              inTopK: acc.inTopK,
            }
          }

          return acc
        },
        { rankedEntriesAndSelf: [], inTopK: false, selfEntry: undefined }
      ),
    [leaderboard, participant]
  )

  const filteredEntries = useMemo(() => {
    if (typeof topKOnly === 'undefined') return rankedEntriesAndSelf

    return rankedEntriesAndSelf.filter(
      (entry: LeaderboardCombinedEntry) => entry.rank <= topKOnly
    )
  }, [])

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
        {filteredEntries.map((entry: LeaderboardCombinedEntry) =>
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
                onParticipantClick && typeof entry.participantId !== 'undefined'
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
                onParticipantClick && typeof entry.participantId !== 'undefined'
                  ? () => onParticipantClick(entry.participantId!, false)
                  : undefined
              }
              className={className?.listItem}
            />
          )
        )}
        {typeof topKOnly !== 'undefined' && !inTopK && selfEntry && (
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
