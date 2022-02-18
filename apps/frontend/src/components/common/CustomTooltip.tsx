import { Popup, Icon } from 'semantic-ui-react'
import clsx from 'clsx'

interface CustomTooltipProps {
  content: any
  iconName?: any
  position?: any
  iconObject?: any
  className?: any
}

const CustomTooltip = ({ content, iconName, position, iconObject, className }: CustomTooltipProps) => {
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
          iconObject || (
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
