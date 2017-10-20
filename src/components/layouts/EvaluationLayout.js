import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Helmet } from 'react-helmet'
import { FormattedMessage, intlShape } from 'react-intl'
import { Checkbox } from 'semantic-ui-react'

import { createLinks, initLogging } from '../../lib'
import Possibilities from '../evaluation/Possibilities'
import VisualizationType from '../evaluation/VisualizationType'
import { SemanticVersion } from '../../constants'

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
            `https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/${SemanticVersion}/semantic.min.css`,
          ])}
          <title>{pageTitle}</title>
        </Helmet>

        <div className="questionDetails">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="chart">{children}</div>
        <div className="settings">
          <Checkbox
            toggle
            label={intl.formatMessage({
              defaultMessage: 'Show solution',
              id: 'teacher.evaluation.showSolution.label',
            })}
            onChange={onToggleShowSolution}
          />
        </div>
        <div className="chartType">
          <VisualizationType
            intl={intl}
            onChangeType={onChangeVisualizationType}
            type={type}
            visualization={visualizationType}
          />
        </div>
        <div className="optionDisplay">
          <h2>
            <FormattedMessage
              id="teacher.evaluation.possibilities.title"
              defaultMessage="Possibilities"
            />
          </h2>
          <Possibilities intl={intl} choices={choices} />
        </div>

        <style jsx global>{`
          * {
            font-family: 'Open Sans', sans-serif;
          }

          html {
            font-size: 22px !important;
          }

          body {
            font-size: 1rem !important;
          }
        `}</style>

        <style jsx>{`
          @import 'src/theme';

          .evaluationLayout {
            @supports (grid-gap: 1rem) {
              @include desktop-tablet-only {
                display: grid;

                grid-template-columns: auto 17rem;
                grid-template-rows: minmax(auto, 2rem) auto 10rem 5rem;
                grid-template-areas: 'questionDetails questionDetails' 'graph optionDisplay'
                  'graph settings' 'info chartType';

                height: 100vh;

                .questionDetails {
                  grid-area: questionDetails;
                  align-self: start;

                  background-color: lightgrey;
                  border-bottom: 1px solid grey;
                  padding: 1rem;
                  text-align: left;

                  h1 {
                    font-size: 1.5rem;
                    line-height: 1.5rem;
                    margin-bottom: 0.5rem;
                  }
                }

                .chart {
                  grid-area: graph;

                  padding: 1rem;

                  :global(> *) {
                    border: 1px solid lightgrey;
                  }
                }

                .chartType,
                .optionDisplay,
                .settings {
                  padding: 1rem;
                }

                .chartType {
                  grid-area: chartType;

                  align-self: center;
                }

                .optionDisplay {
                  grid-area: optionDisplay;

                  h2 {
                    font-size: 1.5rem;
                    line-height: 1.5rem;
                    margin-bottom: 0.5rem;
                  }
                }

                .settings {
                  grid-area: settings;

                  align-self: end;
                }
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
