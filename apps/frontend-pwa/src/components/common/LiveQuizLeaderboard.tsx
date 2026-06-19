import { useQuery } from '@apollo/client'
import { GetLiveQuizLeaderboardDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { trpc } from '@lib/trpc'
import { H2, UserNotification } from '@uzh-bf/design-system'
import localforage from 'localforage'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import Leaderboard from '@klicker-uzh/shared-components/src/Leaderboard'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Rank1Img from '../../../public/rank1.svg'
import Rank2Img from '../../../public/rank2.svg'
import Rank3Img from '../../../public/rank3.svg'

type BlockResult = {
  score: number
  rank: number
} | null

function LiveQuizLeaderboard({
  quizId,
  courseId,
  className,
  showLeaderboardGamifiedQuizHint = false,
  isPartOfGamifiedCourse = false,
  isBeforeFirstBlock = false,
  isAssessmentEnabled = false,
}: {
  quizId: string
  courseId?: string | null
  className?: string
  showLeaderboardGamifiedQuizHint?: boolean
  isPartOfGamifiedCourse?: boolean | null
  isBeforeFirstBlock?: boolean
  isAssessmentEnabled?: boolean
}): React.ReactElement {
  const t = useTranslations()
  const router = useRouter()
  const [blockDelta, setBlockDelta] = useState<BlockResult>(null)
  const logoutParticipant = trpc.participant.logout.useMutation()

  const { data: selfData } = trpc.participant.self.useQuery({
    liveQuizId: quizId,
  })
  const self = selfData?.self ?? null

  const { data, loading } = useQuery(GetLiveQuizLeaderboardDocument, {
    variables: { quizId },
    // use network-only to trigger a refetch once the component is displayed
    // TODO: replace this by a send of the leaderboard within the subscription
    // TODO: otherwise, this could overload the server if 1000 simultaneous users are on the leaderboard
    fetchPolicy: 'network-only',
  })

  // save the current leaderboard to local storage
  useEffect(() => {
    const asyncFunc = async () => {
      const leaderboard = data?.liveQuizLeaderboard

      const selfEntry = leaderboard?.find(
        (entry) => entry.participantId === self?.id
      )

      if (selfEntry) {
        localforage.setItem(
          `${selfEntry.participantId}-score-block${selfEntry.lastBlockOrder}`,
          selfEntry
        )

        if (selfEntry.lastBlockOrder && selfEntry.lastBlockOrder > 0) {
          try {
            const prevStoredEntry: BlockResult = await localforage.getItem(
              `${selfEntry.participantId}-score-block${
                selfEntry.lastBlockOrder - 1
              }`
            )
            if (!prevStoredEntry) return

            setBlockDelta({
              score: selfEntry.score - prevStoredEntry.score,
              rank: -(selfEntry.rank - prevStoredEntry.rank),
            })
          } catch (error) {
            console.warn(error)
          }
        }
      }
    }

    asyncFunc()
  }, [data, self?.id])

  if (loading || !data) {
    return <Loader />
  }

  const leaderboard = data.liveQuizLeaderboard ?? []
  return (
    <div
      className={twMerge(
        'mx-auto w-max max-w-full space-y-4 pt-4 md:pt-2',
        className
      )}
    >
      <H2>{t('shared.leaderboard.lqLeaderboard')}</H2>
      <div className="w-200 max-w-full">
        {leaderboard.length && leaderboard.length > 0 ? (
          <Leaderboard
            leaderboard={leaderboard ?? []}
            participant={self}
            podiumImgSrc={{
              rank1: Rank1Img,
              rank2: Rank2Img,
              rank3: Rank3Img,
            }}
            topKOnly={10}
          />
        ) : (
          <UserNotification
            type="info"
            message={t('shared.leaderboard.noPointsCollected')}
            className={{ root: 'mt-1.5 md:text-base' }}
          />
        )}
      </div>

      {/* live quiz is not part of gamified course, but still gamified, 
      participant is logged in with standard account, participation not relevant */}
      {self?.id &&
      !self.scopeQuizId && // regular user login
      showLeaderboardGamifiedQuizHint &&
      !isPartOfGamifiedCourse &&
      isBeforeFirstBlock ? (
        <UserNotification
          type="warning"
          className={{ root: 'w-200 -mt-1 max-w-full md:text-base' }}
          data={{ cy: 'notification-live-quiz-no-gamified-course' }}
        >
          {isAssessmentEnabled
            ? t('shared.leaderboard.liveQuizGamifiedAssessment')
            : t.rich('shared.leaderboard.liveQuizGamifiedNoGamifiedCourse', {
                logout: (text) => (
                  <span
                    onClick={async () => {
                      await logoutParticipant.mutateAsync()
                      sessionStorage.removeItem('participant_token')
                      router.reload()
                    }}
                    className="cursor-pointer underline"
                  >
                    {text}
                  </span>
                ),
              })}
        </UserNotification>
      ) : null}

      {/* live quiz is part of gamified course, but user has no participation in course */}
      {self?.id &&
      !self.scopeQuizId && // regular user login
      !self.isCourseParticipant && // user is not a participant in the course
      showLeaderboardGamifiedQuizHint &&
      isPartOfGamifiedCourse &&
      isBeforeFirstBlock ? (
        <UserNotification
          type="warning"
          className={{ root: 'w-200 -mt-1 max-w-full md:text-base' }}
          data={{
            cy: 'notification-live-quiz-gamified-course-no-participation',
          }}
        >
          {isAssessmentEnabled
            ? t('shared.leaderboard.liveQuizGamifiedAssessment')
            : t.rich(
                'shared.leaderboard.liveQuizGamifiedCourseNoParticipation',
                {
                  logout: (text) => (
                    <span
                      onClick={async () => {
                        await logoutParticipant.mutateAsync()
                        sessionStorage.removeItem('participant_token')
                        router.reload()
                      }}
                      className="cursor-pointer underline"
                    >
                      {text}
                    </span>
                  ),
                }
              )}
        </UserNotification>
      ) : null}

      {/* live quiz is part of gamified course, but user has an inactive participation in course */}
      {self?.id &&
      !self.scopeQuizId && // regular user login
      self.isCourseParticipant && // user is a participant of the course
      self.isCourseParticipationActive === false && // but participation is inactive
      showLeaderboardGamifiedQuizHint &&
      isPartOfGamifiedCourse &&
      isBeforeFirstBlock ? (
        <UserNotification
          type="warning"
          className={{ root: 'w-200 -mt-1 max-w-full md:text-base' }}
          data={{ cy: 'notification-live-quiz-course-participation-inactive' }}
        >
          {t.rich('shared.leaderboard.liveQuizCourseParticipationInactive', {
            link: (text) => (
              <Link href={`/course/${courseId}`} className="underline">
                {text}
              </Link>
            ),
          })}
        </UserNotification>
      ) : null}

      {blockDelta && (
        <div className="flex flex-row gap-4 text-xl">
          <div>
            &Delta; {t('shared.leaderboard.ranks')}:{' '}
            <span
              className={twMerge(
                blockDelta.rank > 0 && 'text-green-700',
                blockDelta.rank < 0 && 'text-red-700'
              )}
            >
              {blockDelta.rank > 0 && '+'}
              {blockDelta.rank}
            </span>
          </div>
          <div>
            &Delta; {t('shared.leaderboard.points')}:{' '}
            <span
              className={twMerge(
                blockDelta.score > 0 && 'text-green-700',
                blockDelta.score < 0 && 'text-red-700'
              )}
            >
              {blockDelta.score > 0 && '+'}
              {blockDelta.score}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveQuizLeaderboard
