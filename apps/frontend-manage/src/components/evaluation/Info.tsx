import React from 'react'

interface Props {
  totalResponses?: number
}

const defaultProps = {
  totalResponses: 0,
}

function Info({ totalResponses }: Props): React.ReactElement {
  return <div className="info print:hidden">Total Teilnehmende: </div>
}

Info.defaultProps = defaultProps

export default Info
