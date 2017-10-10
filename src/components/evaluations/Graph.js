import React from 'react'
import { FormattedMessage, intlShape } from 'react-intl'

// TODO
const propTypes = {
  graphType: intlShape.string,
  intl: intlShape.isRequired,
}

// TODO
const defaultProps = {
  graphType: 'pie',
}

// TODO default value
const Graph = ({ intl, graphType }) => (
  <div className="visualization">
    <div className="title">
      <FormattedMessage id="teacher.evaluation.graph.title" defaultMessage="Graph" />
    </div>

    <style jsx>{`
      .title {
        font-weight: bold;
        margin-bottom: 0.5rem;
      }
    `}</style>
  </div>
)

Graph.propTypes = propTypes
Graph.defaultProps = defaultProps

export default Graph
