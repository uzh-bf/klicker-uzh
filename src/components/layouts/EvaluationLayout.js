import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Helmet } from 'react-helmet'
import { intlShape, FormattedMessage } from 'react-intl'
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
        <hr />
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
          <VisualizationType
            intl={intl}
            onChangeType={onChangeVisualizationType}
            type={type}
            visualization={visualizationType}
          />
        </div>
        <div className="box possibilities">
          <Possibilities intl={intl} choices={choices} />
        </div>

        <style jsx global>{`
          html {
            font-size: 25px;
          }
          body {
            font-size: 1rem;
          }
        `}</style>

        <style jsx>{`
          .box {
            padding: 0.5rem;
          }

          @supports (grid-gap: 1rem) {
            @media all and (min-width: 768px) {
              .evaluationLayout {
                display: grid;

                grid-template-columns: 70% 30%;
                grid-template-rows: auto;
                grid-template-areas: 'title title' 'question question' 'graph possibilities'
                  'graph solution' 'graph visualization';

                margin: 2rem 8rem 0;
              }

              .title {
                grid-area: title;
              }

              .questionText {
                grid-area: question;
              }

              .graph {
                grid-area: graph;
                align-self: center;
                justify-self: center;
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
