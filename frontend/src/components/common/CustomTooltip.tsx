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
      content={content}
      trigger={
        iconObject ? (
          iconObject
        ) : (
          <a data-tip>
            <Icon name={iconName} />
          </a>
        )
      }
      position={position ? position : 'right center'}
      size="small"
      style={{ opacity: 0.9 }}
      mouseEnterDelay={250}
      mouseLeaveDelay={250}
      wide
      inverted
    />
  )
}

export default CustomTooltip
