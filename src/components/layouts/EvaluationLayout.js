import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage, intlShape } from 'react-intl'
import { Checkbox } from 'semantic-ui-react'

import { CommonLayout } from '.'
import VisualizationType from '../evaluation/VisualizationType'

const propTypes = {
  chart: PropTypes.element.isRequired,
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
  options: PropTypes.object.isRequired,
  pageTitle: PropTypes.string,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  visualizationType: PropTypes.string.isRequired,
}

const defaultProps = {
  description: undefined,
  pageTitle: 'EvaluationLayout',
}

const EvaluationLayout = ({
  intl,
  pageTitle,
  onToggleShowSolution,
  chart,
  title,
  type,
  description,
  visualizationType,
  onChangeVisualizationType,
  options,
}) => (
  <CommonLayout baseFontSize="22px" pageTitle={pageTitle}>
    <div className="evaluationLayout">
      <div className="questionDetails">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="info">
        <FormattedMessage
          defaultMessage="Total responses:"
          id="teacher.evaluation.totalResponses.label"
        />
        {}
      </div>
      <div className="chart">{chart}</div>
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
        <h2>Options</h2>
        {options}
      </div>

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
              .settings,
              .info {
                padding: 1rem;
              }

              .info {
                grid-area: info;

                align-self: center;
                padding-top: 0;
              }

              .chartType {
                grid-area: chartType;

                align-self: center;
                padding-top: 0;
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
  </CommonLayout>
)

EvaluationLayout.propTypes = propTypes
EvaluationLayout.defaultProps = defaultProps

export default EvaluationLayout
