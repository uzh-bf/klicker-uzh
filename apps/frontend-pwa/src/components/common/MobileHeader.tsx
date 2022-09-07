import { Button } from '@uzh-bf/design-system'
import React from 'react'

interface MobileHeaderProps {
}

function MobileHeader({
}: MobileHeaderProps): React.ReactElement {
  return (
    <div className="flex flex-row justify-between w-full h-full gap-1 bg-uzh-grey-60">
      <div>KlickerUZH</div>
      <div>Avatar</div>
    </div>
  )
}

export default MobileHeader
