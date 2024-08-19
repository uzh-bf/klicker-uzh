import { faThumbsDown, faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faCheckDouble,
  faThumbsUp as faThumbsUpSolid,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ResponseCorrectnessType } from '@klicker-uzh/graphql/dist/ops'
import { Button, H4 } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import FlagElementModal from '../flags/FlagElementModal'

interface InstanceHeaderProps {
  instanceId: number
  elementId: number
  name: string
  withParticipant: boolean
  correctness?: ResponseCorrectnessType
  className?: string
}

function InstanceHeader({
  instanceId,
  elementId,
  name,
  withParticipant,
  correctness,
  className,
}: InstanceHeaderProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [vote, setVote] = useState(0) // TODO: optionally set this to current feedback in db

  return (
    <div className={twMerge('mb-4', className)}>
      <div className="flex flex-row justify-between pr-1">
        <div className="flex flex-row items-center gap-2">
          {correctness === ResponseCorrectnessType.Correct && (
            <FontAwesomeIcon icon={faCheckDouble} className="text-green-600" />
          )}
          {correctness === ResponseCorrectnessType.Partial && (
            <FontAwesomeIcon icon={faCheck} className="text-yellow-600" />
          )}
          {correctness === ResponseCorrectnessType.Incorrect && (
            <FontAwesomeIcon icon={faXmark} className="text-red-600" />
          )}
          <H4 data={{ cy: `element-instance-header-${name}` }}>{name}</H4>
        </div>
        {withParticipant && (
          <div className="flex flex-row items-center gap-4">
            <Button
              basic
              active={vote === 1}
              onClick={() => alert('// TODO: Implement upvote')}
              data={{ cy: 'flag-element-button' }}
            >
              <Button.Icon>
                <FontAwesomeIcon
                  icon={vote === 1 ? faThumbsUpSolid : faThumbsUp}
                  className={twMerge(
                    'hover:text-primary-80 text-uzh-grey-100',
                    vote === 1 && 'text-primary-80'
                  )}
                />
              </Button.Icon>
            </Button>
            <Button
              basic
              active={vote === -1}
              onClick={() => alert('// TODO: Implement downvote')}
              data={{ cy: 'flag-element-button' }}
            >
              <Button.Icon>
                <FontAwesomeIcon
                  icon={faThumbsDown}
                  className={twMerge(
                    'hover:text-primary-80 text-uzh-grey-100',
                    vote === -1 && 'text-primary-80'
                  )}
                />
              </Button.Icon>
            </Button>
            <FlagElementModal
              open={modalOpen}
              setOpen={setModalOpen}
              instanceId={instanceId}
              elementId={elementId}
            />
          </div>
        )}
      </div>
      <hr className="h-[1px] border-0 bg-gray-300" />
    </div>
  )
}

export default InstanceHeader
