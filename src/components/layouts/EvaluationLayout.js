import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Helmet } from 'react-helmet'
import { intlShape } from 'react-intl'

import { createLinks, initLogging } from '../../lib'

const propTypes = {
  data: PropTypes.shape({
    questionText: PropTypes.string,
    title: PropTypes.string,
  }).isRequired,
  intl: intlShape.isRequired,
  pageTitle: PropTypes.string,
}

const defaultProps = {
  pageTitle: 'EvaluationLayout',
}

class EvaluationLayout extends Component {
  state = {}

  componentWillMount() {
    // initialize sentry and logrocket (if appropriately configured)
    initLogging()
  }

  render() {
    const { pageTitle, data } = this.props

    return (
      <div className="evaluationLayout">
        <Helmet defer={false}>
          {createLinks([
            'https://fonts.googleapis.com/css?family=Open Sans',
            'https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.13/semantic.min.css',
          ])}
          <title>{pageTitle}</title>
        </Helmet>

        <div className="content">
          <div><b>{data.title}</b></div>
          <div>{data.questionText}</div>
          <hr />
          <div className="graph">Graph</div>
          <div className="possibilities">Possibilities</div>
          <div className="sampleSolution">Sample Solution</div>
          <div className="Visualization">Visualization</div>
        </div>

        <style jsx>{`
          .evaluationLayout {
            display: flex;
            flex-direction: column;

            padding: 1rem;
          }
        `}</style>
      </div>
    )
  }
}

EvaluationLayout.propTypes = propTypes
EvaluationLayout.defaultProps = defaultProps

export default EvaluationLayout
