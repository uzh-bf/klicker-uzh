import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
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
  const shouldReduceMotion = useReducedMotion()
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
    [leaderboard, participant]
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

  const renderEntry = (
    entry: LeaderboardCombinedEntry,
    index: number,
    selfIsActive?: boolean
  ): React.ReactElement => {
    const mountDelay = Math.min(index * 0.04, 0.4)

    return (
      <motion.div
        key={entry.id}
        role="listitem"
        layout={!shouldReduceMotion}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
        transition={{
          layout: { duration: 0.35, ease: 'easeOut' },
          opacity: { duration: 0.25, delay: mountDelay },
          y: { duration: 0.25, delay: mountDelay },
        }}
        className={className?.listItem}
      >
        {entry.isSelf === true ? (
          <ParticipantSelf
            isActive={selfIsActive ?? true}
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
          />
        )}
      </motion.div>
    )
  }

  const selfOutsideTopK =
    typeof topKOnly !== 'undefined' && !inTopK && selfEntry !== undefined

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
      <div role="list" className={twMerge('space-y-1.5', className?.list)}>
        <AnimatePresence mode="popLayout" initial={true}>
          {filteredEntries.map((entry, index) => renderEntry(entry, index))}
        </AnimatePresence>

        {selfOutsideTopK && (
          <div
            role="presentation"
            className="flex items-center gap-2 py-0.5 text-xs font-medium text-slate-400"
          >
            <div className="h-px flex-1 bg-slate-200" />
            {t('shared.leaderboard.selfPositionDivider')}
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        )}

        {selfOutsideTopK &&
          renderEntry(
            { ...selfEntry, isSelf: true },
            filteredEntries.length,
            selfEntry.isSelf ?? false
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
