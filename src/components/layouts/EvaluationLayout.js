import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Checkbox, Menu } from 'semantic-ui-react'
import _range from 'lodash/range'

import { CommonLayout } from '.'
import { Info, Possibilities, VisualizationType } from '../evaluation'

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
  totalResponses: PropTypes.number,
  type: PropTypes.string.isRequired,
  visualizationType: PropTypes.string.isRequired,
}

const defaultProps = {
  description: undefined,
  pageTitle: 'EvaluationLayout',
  totalResponses: undefined,
}

function EvaluationLayout({
  intl,
  pageTitle,
  onToggleShowSolution,
  chart,
  title,
  type,
  description,
  visualizationType,
  onChangeVisualizationType,
  totalResponses,
  options,
  numInstances,
  activeInstance,
  onChangeActiveInstance,
}) {
  return (
    <CommonLayout baseFontSize="22px" pageTitle={pageTitle}>
      <div className="evaluationLayout">
        {numInstances > 0 && (
          <div className="instanceChooser">
            <Menu fitted tabular>
              {_range(numInstances).map(num => (
                <Menu.Item
                  fitted
                  active={num === activeInstance}
                  onClick={onChangeActiveInstance(num)}
                >
                  {num}
                </Menu.Item>
              ))}
            </Menu>
          </div>
        )}

        <div className="questionDetails">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <div className="info">
          <Info totalResponses={totalResponses} />
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
          <Possibilities questionType={type} questionOptions={options} />
        </div>

        <style jsx>{`
          @import 'src/theme';

          .evaluationLayout {
            @supports (grid-gap: 1rem) {
              @include desktop-tablet-only {
                display: grid;

                grid-template-columns: auto 17rem;
                grid-template-rows: minmax(auto, 0) minmax(auto, 2rem) auto 10rem 5rem;
                grid-template-areas: 'instanceChooser instanceChooser'
                  'questionDetails questionDetails' 'graph optionDisplay' 'graph settings'
                  'info chartType';

                height: 100vh;

                .instanceChooser {
                  grid-area: instanceChooser;
                  padding: 0.3rem;
                  padding-bottom: 0;

                  :global(.menu .item) {
                    padding: 0 1rem;
                    margin-bottom: 0;
                  }
                }

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
}

EvaluationLayout.propTypes = propTypes
EvaluationLayout.defaultProps = defaultProps

export default EvaluationLayout
