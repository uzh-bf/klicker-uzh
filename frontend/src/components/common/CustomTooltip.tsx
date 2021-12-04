import { Popup, Icon } from 'semantic-ui-react'

interface CustomTooltipProps {
  content: any
  iconName?: any
  position?: any
  iconObject?: any
}

const CustomTooltip = ({ content, iconName, position, iconObject }: CustomTooltipProps) => {
  return (
    <Popup
      inverted
      wide
      content={content}
      mouseEnterDelay={250}
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
  )
}

export default CustomTooltip
