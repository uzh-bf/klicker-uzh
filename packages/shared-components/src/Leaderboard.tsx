import { LeaderboardEntry, Participant } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'
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
          <div className="prose max-w-none p-2 bg-slate-100 rounded border-slate-300 border text-slate-600 text-sm">
            <p className="text-center">
              🎊 A warm welcome, {participant.username}, to the course{' '}
              <span className="font-bold">"{courseName}"</span> 🎊
            </p>
            <p>
              You are currently <span className="font-bold">not</span>{' '}
              participating in the course leaderboard, meaning that you will not
              collect any points, will not be listed on the leaderboard, and
              will not be eligible for achievements and awards. You will be able
              to join a group and can participate in group activities, but will
              not be contributing any points toward the group score.
            </p>
            <p>
              If you join the course leaderboard using the button below, the{' '}
              <span className="font-bold">course creator</span> will see some of
              your information to facilitate the activities of your course:
              specifically, your{' '}
              <span className="font-bold">email address and username</span>, the
              activities you have participated in, as well as your collected
              points in said activities.{' '}
              <span className="font-bold">No details on the content</span> of
              your questions (e.g., questions in live Q&A) or responses (e.g.,
              what you respond to polls) will be shared with the course creator.
            </p>
            <p>
              Other participants will only see your{' '}
              <span className="font-bold">public participant profile</span>{' '}
              including pseudonym and total points/achievements on leaderboards.
              You can choose to hide your profile from other participants while
              still participating in the leaderboard, if you wish to do so (see{' '}
              <Link href="/editProfile">here</Link>).
            </p>
            <p>
              You can leave the course leaderboard at any time, upon which all
              of your collected points will be{' '}
              <span className="font-bold">deleted</span>. If you would like to
              participate in the gamified activities throughout this course,
              please <span className="font-bold">click the button below</span>{' '}
              to join.
            </p>
            <Button fluid className={{ root: 'bg-white' }} onClick={onJoin}>
              Join the leaderboard for{' '}
              <span className="font-bold">{courseName}</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Leaderboard
