import { Popup, Icon } from 'semantic-ui-react'
import clsx from 'clsx'

interface SemanticCustomTooltipProps {
  content: any
  iconName?: any
  position?: any
  trigger?: any
  className?: any
}

const SemanticCustomTooltip = ({ content, iconName, position, trigger, className }: SemanticCustomTooltipProps) => {
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

export default SemanticCustomTooltip
