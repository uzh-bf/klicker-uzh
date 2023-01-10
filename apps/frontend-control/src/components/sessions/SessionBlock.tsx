import { faClock, faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  SessionBlock as Block,
  SessionBlockStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Countdown, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useMemo } from 'react'

interface SessionBlockProps {
  block?: Block
}

function SessionBlock({ block }: SessionBlockProps) {
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
    <div className="mb-2 border border-solid rounded-md border-uzh-grey-100">
      <div className="flex flex-row justify-between p-1 bg-uzh-grey-40">
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

export default SessionBlock
