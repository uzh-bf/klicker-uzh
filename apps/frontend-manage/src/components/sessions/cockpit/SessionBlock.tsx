import Ellipsis from '@components/common/Ellipsis'
import {
  QuestionInstance,
  SessionBlock as SessionBlockType,
} from '@klicker-uzh/graphql/dist/ops'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface SessionBlockProps {
  className?: string
  active: boolean
  block: SessionBlockType
}

const defaultProps = {
  className: '',
}

function SessionBlock({
  className,
  active,
  block,
}: SessionBlockProps): React.ReactElement {
  return (
    <div
      className={twMerge(
        className,
        'm-2 bg-uzh-grey-40 p-2 rounded-lg',
        active && 'bg-green-300'
      )}
    >
      Block ID {block.id}
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
