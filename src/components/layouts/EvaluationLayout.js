import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Checkbox, Menu } from 'semantic-ui-react'

import { CommonLayout } from '.'
import { Info, Possibilities, Statistics, VisualizationType } from '../evaluation'
import { QUESTION_GROUPS } from '../../constants'

const propTypes = {
  activeInstance: PropTypes.number,
  chart: PropTypes.element.isRequired,
  choices: PropTypes.arrayOf(
    PropTypes.shape({
      correct: PropTypes.bool,
      name: PropTypes.string.isRequired,
    }),
  ).isRequired,
  data: PropTypes.arrayOf().isRequired,
  description: PropTypes.string,
  instanceSummary: PropTypes.arrayOf(PropTypes.object),
  intl: intlShape.isRequired,
  onChangeActiveInstance: PropTypes.func.isRequired,
  onChangeVisualizationType: PropTypes.func.isRequired,
  onToggleShowSolution: PropTypes.func.isRequired,
  options: PropTypes.object.isRequired,
  pageTitle: PropTypes.string,
  showSolution: PropTypes.bool,
  statistics: PropTypes.shape({
    mean: PropTypes.number.isRequired,
    median: PropTypes.number.isRequired,
  }),
  title: PropTypes.string.isRequired,
  totalResponses: PropTypes.number,
  type: PropTypes.string.isRequired,
  visualizationType: PropTypes.string.isRequired,
}

const defaultProps = {
  activeInstance: 0,
  description: undefined,
  instanceSummary: [],
  pageTitle: 'EvaluationLayout',
  showSolution: false,
  statistics: undefined,
  totalResponses: undefined,
}

function EvaluationLayout({
  intl,
  pageTitle,
  showSolution,
  onToggleShowSolution,
  chart,
  type,
  description,
  visualizationType,
  onChangeVisualizationType,
  totalResponses,
  options,
  activeInstance,
  onChangeActiveInstance,
  instanceSummary,
  statistics,
}) {
  return (
    <CommonLayout baseFontSize="22px" pageTitle={pageTitle}>
      <div className="evaluationLayout">
        {instanceSummary.length > 1 && (
          <div className="instanceChooser">
            <Menu fitted tabular>
              {instanceSummary.map(({ title, totalResponses: count }, index) => (
                <Menu.Item
                  fitted
                  active={index === activeInstance}
                  onClick={onChangeActiveInstance(index)}
                >
                  {title} ({count})
                </Menu.Item>
              ))}
            </Menu>
          </div>
        )}

        <div className="questionDetails">
          <p>{description}</p>
        </div>

        <div className="info">
          <Info totalResponses={totalResponses} />
          <Checkbox
            toggle
            defaultChecked={showSolution}
            label={intl.formatMessage({
              defaultMessage: 'Show solution',
              id: 'teacher.evaluation.showSolution.label',
            })}
            onChange={onToggleShowSolution}
          />
          <VisualizationType
            intl={intl}
            type={type}
            visualization={visualizationType}
            onChangeType={onChangeVisualizationType}
          />
        </div>

        <div className="chart">{chart}</div>

        {QUESTION_GROUPS.POSSIBILITIES.includes(type) && (
          <div className="optionDisplay">
            <Possibilities questionOptions={options} questionType={type} />
          </div>
        )}

        {QUESTION_GROUPS.STATISTICS.includes(type) &&
          statistics && (
            <div className="statistics">
              <Statistics {...statistics} />
            </div>
          )}

        <style jsx>{`
          @import 'src/theme';

          .evaluationLayout {
            @supports (grid-gap: 1rem) {
              @include desktop-tablet-only {
                display: grid;

                grid-template-columns: auto 17rem;
                grid-template-rows:
                  minmax(auto, 0) minmax(auto, 2rem) minmax(auto, 0) minmax(auto, 0)
                  auto minmax(auto, 0);
                grid-template-areas:
                  'instanceChooser instanceChooser'
                  'questionDetails questionDetails' 'graph optionDisplay' 'graph statistics' 'graph statistics'
                  'info info';

                height: 100vh;

                .instanceChooser {
                  grid-area: instanceChooser;
                  padding: 0.3rem;
                  padding-bottom: 0;

                  :global(.menu .item) {
                    font-size: 0.7rem;
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

                  p {
                    font-size: 1.2rem;
                    font-weight: bold;
                    line-height: 1.2rem;
                  }
                }

                .chart {
                  grid-area: graph;

                  height: 100%;
                  padding: 1rem;

                  :global(> *) {
                    border: 1px solid lightgrey;
                  }
                }

                .chartType,
                .optionDisplay,
                .settings,
                .statistics,
                .info {
                  padding: 1rem;
                }

                .info {
                  grid-area: info;

                  align-self: end;
                  padding-top: 0;

                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  justify-content: space-between;
                }

                .optionDisplay {
                  grid-area: optionDisplay;

                  h2 {
                    font-size: 1.5rem;
                    line-height: 1.5rem;
                    margin-bottom: 0.5rem;
                  }
                }

                .statistics {
                  grid-area: statistics;
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
