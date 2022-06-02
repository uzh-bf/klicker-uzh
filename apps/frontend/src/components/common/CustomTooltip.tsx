import { Popup, Icon } from 'semantic-ui-react'
import clsx from 'clsx'

interface CustomTooltipProps {
  content: any
  iconName?: any
  position?: any
  trigger?: any
  className?: any
}

const CustomTooltip = ({ content, iconName, position, trigger, className }: CustomTooltipProps) => {
  return (
    <span className={clsx(className)}>
      <Popup
        inverted
        wide
        content={content}
        mouseEnterDelay={750}
        mouseLeaveDelay={250}
        position={position || 'right center'}
        size="small"
        style={{ opacity: 0.9 }}
        trigger={
          trigger || (
            <a data-tip>
              <Icon name={iconName} />
            </a>
          )
        }
      />
    </span>
  )
}

export default CustomTooltip
