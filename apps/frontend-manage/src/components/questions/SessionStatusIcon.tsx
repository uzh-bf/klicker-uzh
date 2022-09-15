import React from 'react'

interface Props {
  status: string
}

function SessionStatusIcon({ status }: Props): React.ReactElement {
  if (status === 'EXECUTED') {
    return <div>// TODO: IC Checkmark</div>
  }

  if (status === 'ACTIVE') {
    return <div>// TODO: IC comments outline</div>
  }

  return <div>// TOOD: IC calendar outline</div>
}

export default SessionStatusIcon
