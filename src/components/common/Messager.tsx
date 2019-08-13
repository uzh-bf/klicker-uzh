import React from 'react'
import { Message } from 'semantic-ui-react'

interface Props {
  message: string
}

function Messager({ message }: Props): React.ReactElement {
  return (
    <div className="messager">
      <Message>{message}</Message>

      <style jsx>{`
        .messager {
          padding: 1rem;
        }
      `}</style>
    </div>
  )
}

export default Messager
