import React from 'react'
import { FormattedMessage } from 'react-intl'

interface Props {
  totalResponses?: number
}

const defaultProps = {
  totalResponses: 0,
}

function Info({ totalResponses }: Props): React.ReactElement {
  return (
    <div className="info print:hidden">
      <FormattedMessage defaultMessage="Total participants:" id="evaluation.totalParticipants.label" /> {totalResponses}
    </div>
  )
}

Info.defaultProps = defaultProps

export default Info
