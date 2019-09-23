import React from 'react'
import { Popup, Icon } from 'semantic-ui-react'

interface Props {
  children: string
  maxLength?: number
  withPopup?: boolean
}

function Ellipsis({ children, maxLength, withPopup }: Props): React.ReactElement {
  if (children.length <= maxLength || typeof children !== 'string') {
    return <span title={children}>{children}</span>
  }
  return (
    <span title={children}>
      {children.substr(0, maxLength)}{' '}
      {withPopup ? (
        <Popup content={children} trigger={<Icon name="ellipsis horizontal" size="small" />} wide="very" />
      ) : (
        <Icon name="ellipsis horizontal" size="small" />
      )}
    </span>
  )
}

Ellipsis.defaultProps = {
  maxLength: 60,
  withPopup: false,
}

export default Ellipsis
