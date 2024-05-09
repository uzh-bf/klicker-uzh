import {
  faCheck,
  faCheckDouble,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ResponseCorrectnessType } from '@klicker-uzh/graphql/dist/ops'
import { H4 } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import FlagElementModal from '../flags/FlagElementModal'

interface InstanceHeaderProps {
  instanceId: number
  name: string
  withParticipant: boolean
  correctness?: ResponseCorrectnessType
  className?: string
}

function InstanceHeader({
  instanceId,
  name,
  withParticipant,
  correctness,
  className,
}: InstanceHeaderProps) {
  const [modalOpen, setModalOpen] = useState(false)

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
          <FlagElementModal
            open={modalOpen}
            setOpen={setModalOpen}
            instanceId={instanceId}
          />
        )}
      </div>
      <hr className="h-[1px] border-0 bg-gray-300" />
    </div>
  )
}

export default InstanceHeader
