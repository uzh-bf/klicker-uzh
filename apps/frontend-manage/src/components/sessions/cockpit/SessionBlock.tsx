import {
  faCalendar,
  faCheck,
  faExternalLink,
  faSave,
  faSync,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  QuestionInstance,
  SessionBlockStatus,
  SessionBlock as SessionBlockType,
} from '@klicker-uzh/graphql/dist/ops'
import { CycleCountdown } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface SessionBlockProps {
  className?: string
  active: boolean
  block: SessionBlockType
  inCooldown: boolean
  setInCooldown: (value: boolean) => void
}

const ICON_MAP = {
  [SessionBlockStatus.Executed]: faCheck,
  [SessionBlockStatus.Scheduled]: faCalendar,
  [SessionBlockStatus.Active]: faSync,
}

function SessionBlock({
  className,
  active,
  block,
  inCooldown,
  setInCooldown,
}: SessionBlockProps): React.ReactElement {
  const t = useTranslations()
  const [endTime, setEndTime] = useState<Date>()
  const [timerColor, setTimerColor] = useState<string | undefined>(undefined)
  const [totalDuration, setTotalDuration] = useState<number | undefined | null>(
    undefined
  )

  // cooldown duration in seconds
  const cooldownDuration = 10

  // compute the time until expiration (student-visible time) and
  // the time until the block is closed (including cooldown)
  const { expiration: expirationTime, closure: closureTime } = useMemo(() => {
    if (block.status === SessionBlockStatus.Executed) {
      setTotalDuration(0)
      return { expiration: undefined, closure: undefined }
    }
    const timeUntilExpiration = block.expiresAt
      ? dayjs(block.expiresAt).diff(dayjs(), 'second')
      : block.timeLimit
    const timeUntilClosure = block.expiresAt
      ? dayjs(block.expiresAt).diff(dayjs(), 'second') + cooldownDuration
      : block.timeLimit

    const expirationTime = new Date()
    expirationTime.setSeconds(
      expirationTime.getSeconds() + (timeUntilExpiration ?? 0) + 1
    )
    const closureTime = new Date()
    closureTime.setSeconds(
      closureTime.getSeconds() + (timeUntilClosure ?? 0) + 1
    )
    setTotalDuration((timeUntilExpiration ?? 0) + 1)
    setEndTime(expirationTime)

    return { expiration: expirationTime, closure: closureTime }
  }, [block.expiresAt, block.status, block.timeLimit])

  return (
    <div
      className={twMerge(
        className,
        'bg-uzh-grey-40 p-4 rounded min-w-[150px]',
        active && 'bg-green-300',
        inCooldown && 'bg-orange-200'
      )}
    >
      <div
        className={twMerge(
          'flex flex-row justify-between items-center text-gray-700 font-bold'
        )}
      >
        <div>
          <FontAwesomeIcon icon={ICON_MAP[block.status]} />
        </div>
        <div>{t('manage.cockpit.blockN', { number: block.order! + 1 })}</div>
        {block.timeLimit && (
          <CycleCountdown
            key={`${block.id}-${endTime}-${totalDuration}`}
            size="sm"
            isStatic={
              !block.expiresAt || block.status === SessionBlockStatus.Executed
            }
            color={timerColor}
            expiresAt={endTime ?? new Date()}
            strokeWidthRem={0.2}
            totalDuration={totalDuration ?? 0}
            terminalPercentage={100}
            onUpdate={(timeRemaining) => {
              if (timeRemaining < 1.5) {
                setTimerColor('#FF4D01')
                setEndTime(closureTime)
                setTotalDuration((cooldownDuration ?? 0) + 1)
                setInCooldown(true)
              }
            }}
            formatter={(value) => {
              if (inCooldown && value !== 0) {
                return <FontAwesomeIcon icon={faSave} />
              } else {
                return Math.max(value - 1, 0)
              }
            }}
          />
        )}
      </div>
      {block.instances?.map((instance: QuestionInstance) => (
        <div key={instance.id}>
          <Link
            href={`/questions/${instance.questionData.questionId}`}
            className="text-sm sm:hover:text-slate-700"
            target="_blank"
            legacyBehavior
            passHref
          >
            <a data-cy={`open-embedding-link-session-${instance.id}`}>
              {instance.questionData.name}{' '}
              <FontAwesomeIcon className="ml-1 text-xs" icon={faExternalLink} />
            </a>
          </Link>
        </div>
      ))}
    </div>
  )
}

export default SessionBlock
