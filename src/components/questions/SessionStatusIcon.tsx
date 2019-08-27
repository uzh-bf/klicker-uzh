import React from 'react'
import { Icon } from 'semantic-ui-react'

interface Props {
  status: string
}

function SessionStatusIcon({ status }: Props): React.ReactElement {
  if (status === 'EXECUTED') {
    return <Icon name="checkmark" />
  }

  if (status === 'ACTIVE') {
    return <Icon name="comments outline" />
  }

  return <Icon name="calendar outline" />
}

export default SessionStatusIcon
