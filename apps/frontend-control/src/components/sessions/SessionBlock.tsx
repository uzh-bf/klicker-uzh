import { faClock, faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  SessionBlockStatus,
  SessionBlock as SessionBlockType,
} from '@klicker-uzh/graphql/dist/ops'
import { CycleCountdown, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface SessionBlockProps {
  block?: SessionBlockType
  active?: boolean
}

function SessionBlock({ block, active = false }: SessionBlockProps) {
  const t = useTranslations()

  // compute the time until expiration in seconds + 20 seconds buffer from now
  const untilExpiration = useMemo(() => {
    if (!block) return -1
    if (block.status === SessionBlockStatus.Executed) {
      return -1
    }
    return block.expiresAt
      ? dayjs(block.expiresAt).add(20, 'second').diff(dayjs(), 'second')
      : block.timeLimit
  }, [block])

  // compute the expiration time as a date
  const expirationTime = useMemo(() => {
    const time = new Date()
    time.setSeconds(time.getSeconds() + (untilExpiration ?? 0))
    return time
  }, [untilExpiration])

  if (!block)
    return (
      <UserNotification
        type="error"
        message={t('shared.generic.systemError')}
      />
    )

  return (
    <div
      className={twMerge(
        'mb-2 border border-solid rounded-md border-uzh-grey-100',
        active && 'border-uzh-darkgreen-80'
      )}
    >
      <div
        className={twMerge(
          'flex flex-row justify-between p-1 bg-uzh-grey-40',
          active && 'bg-green-300'
        )}
      >
        <div className="font-bold">
          {t('control.session.blockN', { number: block.order + 1 })}
        </div>
        <div className="flex flex-row items-center gap-2">
          {block.expiresAt && untilExpiration && (
            <CycleCountdown
              key={`${block.expiresAt}-${block.status}`}
              overrideSize={15}
              isStatic={
                !block.expiresAt || block.status === SessionBlockStatus.Executed
              }
              expiresAt={expirationTime}
              strokeWidthRem={0.2}
              totalDuration={
                block.status !== SessionBlockStatus.Executed
                  ? untilExpiration
                  : 0
              }
              terminalPercentage={100}
              className={{
                root: 'h-7 w-7',
              }}
            />
          )}
          {block.status === SessionBlockStatus.Scheduled && (
            <FontAwesomeIcon icon={faClock} />
          )}
          {block.status === SessionBlockStatus.Active && (
            <FontAwesomeIcon icon={faPlay} />
          )}
        </div>
      </div>
      <div className="flex flex-col p-1">
        {block.instances?.map((instance) => (
          <div key={instance.id} className="line-clamp-1">
            - {instance.questionData?.name}
          </div>
        ))}
      </div>
    </div>
  )
}

export default SessionBlock
