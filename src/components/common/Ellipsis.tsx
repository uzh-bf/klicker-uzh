import React from 'react'

interface Props {
  children: string
  maxLength?: number
}

function Ellipsis({ children, maxLength }: Props): React.ReactElement {
  if (children.length <= maxLength) {
    return <span title={children}>{children}</span>
  }
  return <span title={children}>{children.substr(0, maxLength)} ...</span>
}

Ellipsis.defaultProps = {
  maxLength: 60,
}

export default Ellipsis
