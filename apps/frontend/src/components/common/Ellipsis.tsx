import React from 'react'
import { Popup, Icon } from 'semantic-ui-react'
import useMarkdown from '../../lib/hooks/useMarkdown'

interface Props {
  children: string
  maxLength?: number
  withPopup?: boolean
}

function Ellipsis({ children, maxLength, withPopup }: Props): React.ReactElement {
  const parsedContent = useMarkdown({ content: children })

  // TODO: ensure that we can parse content that is too long and show an ellipsis
  return parsedContent

  // if (children.length <= maxLength || typeof children !== 'string') {
  //   return <span title={children}>{children}</span>
  // }
  // return (
  //   <span title={children}>
  //     {children.substr(0, maxLength)}{' '}
  //     {withPopup ? (
  //       <Popup content={children} trigger={<Icon name="ellipsis horizontal" size="small" />} wide="very" />
  //     ) : (
  //       <Icon name="ellipsis horizontal" size="small" />
  //     )}
  //   </span>
  // )
}

Ellipsis.defaultProps = {
  maxLength: 60,
  withPopup: false,
}

export default Ellipsis
