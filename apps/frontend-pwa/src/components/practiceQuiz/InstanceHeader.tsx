import FlagElementModal from '@components/flags/FlagElementModal'
import { H4 } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface InstanceHeaderProps {
  instanceId: number
  name: string
  withParticipant: boolean
  className?: string
}

function InstanceHeader({
  instanceId,
  name,
  withParticipant,
  className,
}: InstanceHeaderProps) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className={twMerge('mb-4', className)}>
      <div className="flex flex-row justify-between pr-1">
        <H4>{name}</H4>
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
