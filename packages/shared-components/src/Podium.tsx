import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import type { LeaderboardCombinedEntry } from './Leaderboard'
import { ParticipantOther } from './Participant'

const rankHeights: Record<number, string> = {
  1: 'order-1 h-[80px] md:order-2',
  2: 'order-2 h-[70px] md:order-1',
  3: 'order-3 h-[60px]',
}

// staggered rise-in of the three podium slots (3rd -> 2nd -> 1st)
const rankDelays: Record<number, number> = {
  1: 0.3,
  2: 0.15,
  3: 0,
}

interface SinglePodiumProps {
  username?: string
  avatar?: string | null
  score?: number
  rank: number
  noEntries?: boolean
  className?: string
  imgSrc?: any
}

function SinglePodium({
  username,
  avatar,
  score,
  rank,
  noEntries,
  className,
  imgSrc,
}: SinglePodiumProps): React.ReactElement {
  const shouldReduceMotion = useReducedMotion()

  const animationProps: HTMLMotionProps<'div'> = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        transition: {
          y: { duration: 0.5, delay: rankDelays[rank], ease: 'easeOut' },
          opacity: { duration: 0.35, delay: rankDelays[rank] },
        },
      }

  if (!imgSrc) {
    return (
      <motion.div
        className={twMerge(
          'flex flex-1 items-end rounded-t-lg bg-gradient-to-t from-slate-200 to-slate-50 ring-1 ring-inset ring-slate-200',
          rankHeights[rank],
          className
        )}
        {...animationProps}
      >
        <ParticipantOther
          className="w-full border-slate-200 bg-white/80 shadow-none"
          pseudonym={username}
          avatar={avatar}
          points={score ?? 0}
          withAvatar={!!avatar}
        />
      </motion.div>
    )
  }

  return (
    <motion.div className="relative text-center" {...animationProps}>
      <Image
        src={imgSrc}
        alt={`Podium position ${rank}`}
        width={300}
        height={300}
        className="opacity-80"
        priority={rank === 1}
      />

      {!noEntries && (
        <>
          <Image
            src={
              avatar
                ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${avatar}.svg`
                : '/user-solid.svg'
            }
            alt="User avatar"
            height={50}
            width={50}
            className={twMerge(
              'absolute rounded-full bg-opacity-60',
              avatar ? 'bg-white' : 'p-2'
            )}
            style={{
              top: twMerge(
                rank === 1 && '17%',
                rank === 2 && '26%',
                rank === 3 && '29%'
              ),
              left: '33%',
              width: '35%',
            }}
          />

          {typeof score === 'number' && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-slate-700/90 px-2 py-0.5 text-xs font-bold tabular-nums text-white shadow-sm sm:text-sm">
              {score}
            </div>
          )}
        </>
      )}

      <div className="absolute bottom-0 mx-auto w-full truncate px-1 text-sm text-slate-700 sm:text-base md:text-lg lg:text-xl">
        {username}
      </div>
    </motion.div>
  )
}

interface PodiumProps {
  leaderboard: Partial<LeaderboardCombinedEntry>[]
  className?: {
    root?: string
    single?: string
  }
  imgSrc?: {
    rank1: any
    rank2: any
    rank3: any
  }
}
export function Podium({ leaderboard, className, imgSrc }: PodiumProps) {
  const t = useTranslations()

  const { rank1, rank2, rank3 } = useMemo(() => {
    if (!leaderboard) return {}
    return {
      rank1: leaderboard.length >= 1 ? leaderboard[0] : undefined,
      rank2: leaderboard.length >= 2 ? leaderboard[1] : undefined,
      rank3: leaderboard.length >= 3 ? leaderboard[2] : undefined,
    }
  }, [leaderboard])

  // an empty podium is only assumed if no entries exist at all - entries with
  // anonymized profiles (null avatars) are valid and render with a fallback icon
  const noEntries = useMemo(() => {
    return !rank1 && !rank2 && !rank3
  }, [rank1, rank2, rank3])

  if (noEntries) {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400">
        {t('shared.leaderboard.podiumEmpty')}
      </div>
    )
  }

  return (
    <div className={twMerge('flex flex-row items-end gap-4')}>
      <SinglePodium
        rank={2}
        username={rank2?.username}
        avatar={rank2?.avatar}
        score={rank2?.score}
        noEntries={false}
        className={className?.single}
        imgSrc={imgSrc?.rank2}
      />

      <SinglePodium
        rank={1}
        username={rank1?.username}
        avatar={rank1?.avatar}
        score={rank1?.score}
        noEntries={false}
        className={className?.single}
        imgSrc={imgSrc?.rank1}
      />

      <SinglePodium
        rank={3}
        username={rank3?.username}
        avatar={rank3?.avatar}
        score={rank3?.score}
        noEntries={false}
        className={className?.single}
        imgSrc={imgSrc?.rank3}
      />
    </div>
  )
}
