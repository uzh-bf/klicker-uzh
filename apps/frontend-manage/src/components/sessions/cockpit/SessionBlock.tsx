import Ellipsis from '@components/common/Ellipsis'
import { faCalendar, faCheck, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  QuestionInstance,
  SessionBlock as SessionBlockType,
  SessionBlockStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Countdown } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface SessionBlockProps {
  className?: string
  active: boolean
  block: SessionBlockType
}

const defaultProps = {
  className: '',
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
}: SessionBlockProps): React.ReactElement {
  const untilExpiration = useMemo(
    () =>
      block.expiresAt
        ? dayjs(block.expiresAt).diff(dayjs(), 'second')
        : block.timeLimit,
    [block.expiresAt, block.timeLimit]
  )

  return (
    <div
      className={twMerge(
        className,
        'm-2 bg-uzh-grey-40 p-2 rounded-lg',
        active && 'bg-green-300'
      )}
    >
      <div
        className={twMerge(
          'flex flex-row justify-between text-gray-700 font-bold'
        )}
      >
        <div>
          <FontAwesomeIcon icon={ICON_MAP[block.status]} />
        </div>
        <div>Block {block.order + 1}</div>
        {untilExpiration && (
          <Countdown
            isStatic={!block.expiresAt}
            countdownDuration={
              block.status !== SessionBlockStatus.Executed ? untilExpiration : 0
            }
            size={25}
            strokeWidth={3}
            className="text-xs"
          />
        )}
      </div>
      {block.instances.map((instance: QuestionInstance) => (
        <div key={instance.id} className="text-sm">
          <Ellipsis maxLength={30}>{instance.questionData.content}</Ellipsis>
        </div>
      ))}
    </div>
  )
}

SessionBlock.defaultProps = defaultProps
export default SessionBlock
