import { LeaderboardEntry, Participant } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { ParticipantOther, ParticipantSelf } from './Participant'
import { Podium } from './Podium'

interface LeaderboardProps {
  courseName?: string
  leaderboard: any[]
  activeParticipation?: boolean
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
  courseName,
  leaderboard,
  activeParticipation,
  onJoin,
  onLeave,
  onParticipantClick,
  participant,
  hidePodium,
  hideAvatars,
  className,
  podiumImgSrc,
}: LeaderboardProps): React.ReactElement {
  const t = useTranslations()

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
              imgSrc={podiumImgSrc}
            />
          )}
        </div>
        {activeParticipation && (
          <div className={twMerge('space-y-1', className?.list)}>
            {top10.map((entry: LeaderboardEntry) =>
              entry.isSelf === true && onLeave ? (
                <ParticipantSelf
                  key={entry.id}
                  isActive={activeParticipation ?? true}
                  pseudonym={entry.username}
                  level={entry.level}
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
                  level={entry.level}
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
          </div>
        )}
        {participant?.id && onJoin && onLeave && !activeParticipation && (
          <div className="max-w-none p-2 bg-slate-100 rounded border-slate-300 border text-slate-600 text-sm">
            <Markdown
              withProse
              withLinkButtons={false}
              content={t('pwa.general.joinLeaderboardNotice')}
            />
            <Button fluid className={{ root: 'bg-white' }} onClick={onJoin}>
              {t.rich('pwa.courses.joinLeaderboardCourse', {
                name: courseName,
                b: (text) => <span className="font-bold">{text}</span>,
              })}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Leaderboard
