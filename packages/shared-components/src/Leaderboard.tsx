import type { Participant } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
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
  score?: number
  rank: number
  level?: number | null
  isSelf?: boolean | null
  isTemporary?: boolean | null
}

interface LeaderboardProps {
  leaderboard: LeaderboardCombinedEntry[]
  onJoin?: () => void
  onLeave?: () => void
  onParticipantClick?: (participantId: string, isSelf: boolean) => void
  participant?: Omit<
    Participant,
    'isActive' | 'locale' | 'participantGroups'
  > | null
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
  const t = useTranslations()
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
              inTopK: typeof topKOnly !== 'undefined' ? ix < topKOnly : false,
              selfEntry: entry,
            }
          }

          if (typeof topKOnly === 'undefined' || ix < topKOnly) {
            return {
              rankedEntriesAndSelf: [...acc.rankedEntriesAndSelf, entry],
              inTopK: acc.inTopK,
            }
          }

          return acc
        },
        { rankedEntriesAndSelf: [], inTopK: false, selfEntry: undefined }
      ),
    [leaderboard, participant, topKOnly]
  )

  const filteredEntries = useMemo(() => {
    if (typeof topKOnly === 'undefined') return rankedEntriesAndSelf

    return rankedEntriesAndSelf.filter(
      (entry: LeaderboardCombinedEntry) => entry.rank <= topKOnly
    )
  }, [rankedEntriesAndSelf, topKOnly])

  const hasTemporaryParticipants = useMemo(
    () => filteredEntries.some((entry) => entry.isTemporary),
    [filteredEntries]
  )

  return (
    <div className={twMerge('w-full space-y-4', className?.root)}>
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
              isTemporary={entry.isTemporary}
              pseudonym={entry.username}
              avatar={entry.avatar}
              withAvatar={!hideAvatars}
              points={entry.score}
              rank={entry.rank}
              level={entry.level}
              onJoinLeaderboard={onJoin}
              onLeaveLeaderboard={onLeave}
              onClick={
                onParticipantClick && typeof entry.participantId !== 'undefined'
                  ? () => onParticipantClick(entry.participantId!, true)
                  : undefined
              }
            />
          ) : (
            <ParticipantOther
              key={entry.id}
              isTemporary={entry.isTemporary}
              rank={entry.rank}
              pseudonym={entry.username}
              avatar={entry.avatar}
              withAvatar={!hideAvatars}
              points={entry.score}
              level={entry.level}
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
            isTemporary={selfEntry.isTemporary}
            isActive={selfEntry.isSelf ?? false}
            pseudonym={selfEntry.username}
            avatar={selfEntry.avatar}
            withAvatar={!hideAvatars}
            points={selfEntry.score}
            rank={selfEntry.rank}
            level={selfEntry.level}
            onJoinLeaderboard={onJoin}
            onLeaveLeaderboard={onLeave}
          />
        )}
        {hasTemporaryParticipants && (
          <div className="text-base">
            * {t('pwa.liveQuiz.temporaryParticipantsLeaderboard')}
          </div>
        )}
      </div>
    </div>
  )
}

export default Leaderboard
