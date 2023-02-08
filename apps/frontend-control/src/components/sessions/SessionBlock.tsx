import { faClock, faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SessionBlockStatus } from '@klicker-uzh/graphql/dist/ops'
import { Countdown, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface SessionBlockProps {
  block?: {
    expiresAt?: string
    timeLimit?: number | null
    order: number
    status: SessionBlockStatus
    instances: {
      id: number
      questionData: {
        name: string
      }
    }[]
  }
  active?: boolean
}

const defaultProps = {
  active: false,
}

function SessionBlock({ block, active }: SessionBlockProps) {
  const untilExpiration = useMemo(
    () =>
      block?.expiresAt
        ? dayjs(block.expiresAt).add(20, 'second').diff(dayjs(), 'second')
        : block?.timeLimit,
    [block?.expiresAt, block?.timeLimit]
  )

  if (!block)
    return (
      <UserNotification
        notificationType="error"
        message="Leider ist ein Fehler aufgetreten."
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
        <div className="font-bold">Block {block.order + 1}</div>
        <div className="flex flex-row items-center gap-2">
          {untilExpiration && (
            <Countdown
              isStatic={!block.expiresAt}
              countdownDuration={
                block.status !== SessionBlockStatus.Executed
                  ? untilExpiration
                  : 0
              }
              size={25}
              strokeWidth={3}
              className={{ root: 'text-xs' }}
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
        {block.instances.map((instance) => (
          <div key={instance.id} className="line-clamp-1">
            - {instance.questionData.name}
          </div>
        ))}
      </div>
    </div>
  )
}

SessionBlock.defaultProps = defaultProps
export default SessionBlock
