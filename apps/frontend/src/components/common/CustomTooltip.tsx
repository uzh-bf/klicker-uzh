import clsx from 'clsx'
import React from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'

// trigger is passed as child of the component
interface Props {
  tooltip: React.ReactNode | string
  tooltipStyle?: string
  triggerStyle?: string
  children: React.ReactNode
}

const defaultProps = { tooltipStyle: '', triggerStyle: '' }

function CustomTooltip({ tooltip, tooltipStyle, triggerStyle, children }: Props): React.ReactElement {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger className={clsx('[all:_unset]', triggerStyle)}>{children}</Tooltip.Trigger>
      <Tooltip.Content
        className={clsx('p-2 text-white bg-black border rounded-md opacity-80 border-1 border-grey-20', tooltipStyle)}
      >
        {tooltip}
        <Tooltip.Arrow />
      </Tooltip.Content>
    </Tooltip.Root>
  )
}

CustomTooltip.defaultProps = defaultProps
export default CustomTooltip
