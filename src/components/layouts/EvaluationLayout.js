import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Helmet } from 'react-helmet'
import { intlShape } from 'react-intl'

import { createLinks, initLogging } from '../../lib'

const propTypes = {
  data: PropTypes.shape({
    questionText: PropTypes.string,
    sampleSolution: PropTypes.node,
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

        <div className="box title">
          <b>{data.title}</b>
        </div>
        <div className="box questionText">{data.questionText}</div>
        <hr />
        <div className="box graph">Graph</div>
        <div className="box possibilities">Possibilities</div>
        <div className="box sampleSolution">{data.sampleSolution}</div>
        <div className="box visualization">Visualization</div>

        <style jsx>{`
          .box {
            padding: 0.5rem;
          }

          @supports (grid-gap: 1rem) {
            @media all and (min-width: 768px) {
              .evaluationLayout {
                display: grid;

                grid-template-columns: 0.5 0.5;
                grid-template-rows: auto;
                grid-template-areas: 'title title' 'question question' 'graph possibilities'
                  'graph solution' 'graph visualization';
              }

              .title {
                grid-area: title;
              }

              .questionText {
                grid-area: question;
              }

              .graph {
                grid-area: graph;
              }

              .possibilities {
                grid-area: possibilities;
              }

              .sampleSolution {
                grid-area: solution;
              }

              .visualization {
                grid-area: visualization;
              }
            }
          }
        `}</style>
      </div>
    )
  }
}

EvaluationLayout.propTypes = propTypes
EvaluationLayout.defaultProps = defaultProps

export default EvaluationLayout
