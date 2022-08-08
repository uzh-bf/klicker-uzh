import * as Tooltip from '@radix-ui/react-tooltip'
import React from 'react'
import { twMerge } from 'tailwind-merge'

// trigger is passed as child of the component
interface Props {
  tooltip: React.ReactNode | string
  tooltipStyle?: string
  triggerStyle?: string
  withArrow?: boolean
  children: React.ReactNode
}

const defaultProps = { tooltipStyle: '', triggerStyle: '', withArrow: true }

function CustomTooltip({ tooltip, tooltipStyle, triggerStyle, withArrow, children }: Props): React.ReactElement {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger className={twMerge('[all:_unset]', triggerStyle)}>{children}</Tooltip.Trigger>
      <Tooltip.Content
        className={twMerge(
          'p-2 text-white bg-black border rounded-md opacity-80 border-1 border-grey-20',
          tooltipStyle
        )}
      >
        {tooltip}
        {withArrow && <Tooltip.Arrow />}
      </Tooltip.Content>
    </Tooltip.Root>
  )
}

CustomTooltip.defaultProps = defaultProps
export default CustomTooltip
