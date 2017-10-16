import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Helmet } from 'react-helmet'
import { FormattedMessage, intlShape } from 'react-intl'
import { Checkbox } from 'semantic-ui-react'

import { createLinks, initLogging } from '../../lib'
import Possibilities from '../evaluations/Possibilities'
import VisualizationType from '../evaluations/VisualizationType'

const propTypes = {
  children: PropTypes.element.isRequired,
  choices: PropTypes.arrayOf(
    PropTypes.shape({
      correct: PropTypes.bool,
      name: PropTypes.string.isRequired,
    }),
  ).isRequired,
  description: PropTypes.string,
  intl: intlShape.isRequired,
  onChangeVisualizationType: PropTypes.func.isRequired,
  onToggleShowSolution: PropTypes.func.isRequired,
  pageTitle: PropTypes.string,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  visualizationType: PropTypes.string.isRequired,
}

const defaultProps = {
  description: undefined,
  pageTitle: 'EvaluationLayout',
}

class EvaluationLayout extends Component {
  state = {}

  componentWillMount() {
    // initialize sentry and logrocket (if appropriately configured)
    initLogging()
  }

  render() {
    const {
      intl,
      pageTitle,
      onToggleShowSolution,
      children,
      title,
      type,
      description,
      visualizationType,
      onChangeVisualizationType,
      choices,
    } = this.props

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
          <h1>{title}</h1>
        </div>
        <div className="box questionText">{description}</div>
        <div className="box graph">{children}</div>
        <div className="box sampleSolution">
          <h2>
            <FormattedMessage
              id="teacher.evaluation.sampleSolution.title"
              defaultMessage="Sample Solution"
            />
          </h2>
          <Checkbox
            toggle
            label={intl.formatMessage({
              defaultMessage: 'Show',
              id: 'teacher.evaluation.sampleSolution.show',
            })}
            onChange={onToggleShowSolution}
          />
        </div>
        <div className="box visualization">
          <h2>
            <FormattedMessage
              id="teacher.evaluation.visualization.title"
              defaultMessage="Visualization"
            />
          </h2>
          <VisualizationType
            intl={intl}
            onChangeType={onChangeVisualizationType}
            type={type}
            visualization={visualizationType}
          />
        </div>
        <div className="box possibilities">
          <h2>
            <FormattedMessage
              id="teacher.evaluation.possibilities.title"
              defaultMessage="Possibilities"
            />
          </h2>
          <Possibilities intl={intl} choices={choices} />
        </div>

        <style jsx global>{`
          html {
            font-size: 25px !important;
          }
          body {
            font-size: 1rem !important;
          }
        `}</style>

        <style jsx>{`
          h2 {
            font-size: 1.2rem;
          }

          .box {
            padding: 0.1rem;
          }

          .title {
            text-align: center;
          }

          .possibilities {
            text-align: center;
          }

          .sampleSolution {
          text-align: center;
          }

          .visualization {
          text-align: center;
          }

          @supports (grid-gap: 1rem) {
            @media all and (min-width: 768px) {
              .evaluationLayout {
                display: grid;

                grid-template-columns: 80% 20%;
                grid-template-rows: 3rem 15% auto 8rem 8rem 3rem;
                grid-template-areas: 'title title' 'question question' 'graph possibilities'
                  'graph solution' 'graph visualization' 'info info';

                height: 100vh;
                padding: 1rem;
              }

              .title {
                grid-area: title;
              }

              .questionText {
                grid-area: question;

                border-bottom: 1px solid;
              }

              .graph {
                grid-area: graph;
              }

              .possibilities {
                grid-area: possibilities;
              }

              .sampleSolution {
                grid-area: solution;
                margin-top: auto;
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
