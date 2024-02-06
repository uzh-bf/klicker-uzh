import { H4 } from '@uzh-bf/design-system'
import React from 'react'

interface InstanceHeaderProps {
  name: string
  className?: string
}

function InstanceHeader({ name, className }: InstanceHeaderProps) {
  return (
    <div className={className}>
      <div className="flex flex-row justify-between">
        <H4>{name}</H4>
        <div>ICONS</div>
      </div>
      <hr className="h-[1px] border-0 bg-gray-300" />
    </div>
  )
}

export default InstanceHeader
