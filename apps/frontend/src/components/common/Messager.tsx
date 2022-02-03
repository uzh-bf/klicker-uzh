import React from 'react'
import { Message } from 'semantic-ui-react'

interface Props {
  message: string
}

function Messager({ message }: Props): React.ReactElement {
  return (
    <div className="p-4">
      <Message>{message}</Message>
    </div>
  )
}

export default Messager
