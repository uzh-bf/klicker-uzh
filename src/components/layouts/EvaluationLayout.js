import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Checkbox, Menu } from 'semantic-ui-react'

import { CommonLayout } from '.'
import { Info, Possibilities, VisualizationType } from '../evaluation'

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
  totalResponses: undefined,
}

function EvaluationLayout({
  intl,
  pageTitle,
  onToggleShowSolution,
  chart,
  type,
  description,
  visualizationType,
  onChangeVisualizationType,
  totalResponses,
  options,
  data,
  activeInstance,
  onChangeActiveInstance,
  instanceSummary,
}) {
  const calculateAverage = (array) => {
    const valuesArray = []
    array.map(({ value }) => valuesArray.push(+value))

    const sum = valuesArray.reduce((a, b) => a + b, 0)
    return sum / array.length
  }

  const calculateMedian = (array) => {
    const valuesArray = []
    array.map(({ value }) => valuesArray.push(+value))

    // TODO correct assumption that they are already sorted?
    const half = Math.floor(valuesArray.length / 2)

    return array.length % 2 ? valuesArray[half] : (valuesArray[half - 1] + valuesArray[half]) / 2.0
  }

  const calculateMin = (array) => {
    const valuesArray = []
    array.map(({ value }) => valuesArray.push(+value))

    return Math.min.apply(null, valuesArray)
  }

  const calculateMax = (array) => {
    const valuesArray = []
    array.map(({ value }) => valuesArray.push(+value))

    return Math.max.apply(null, valuesArray)
  }

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

        {type === 'FREE' && (
          <div className="statistics">
            <div>
              <div className="value">{calculateAverage(data)}</div>
              <div className="label">Average</div>
            </div>
            <div>
              <div className="value">{calculateMedian(data)}</div>
              <div className="label">Median</div>
            </div>
            <div>
              <div className="value">{calculateMin(data)}</div>
              <div className="label">Minimum</div>
            </div>
            <div>
              <div className="value">{calculateMax(data)}</div>
              <div className="label">Maximum</div>
            </div>
          </div>
        )}

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
                grid-template-areas:
                  'instanceChooser instanceChooser'
                  'questionDetails questionDetails' 'graph optionDisplay' 'graph statistics' 'graph settings'
                  'info chartType';

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

                .statistics {
                  grid-area: statistics;
                  align-self: center;

                  display: flex;
                  flex-direction: row;
                  flex-wrap: wrap;
                  justify-content: space-between;
                }

                .statistics > div {
                  flex-basis: calc(50% - 14px);
                  width: 50%;
                  margin-bottom: 1rem;
                }

                .statistics > div > .value {
                  font-size: 1.3rem;
                  font-weight: 400;
                  line-height: 1em;
                  color: #1b1c1d;
                  text-transform: uppercase;
                  text-align: center;
                }

                .statistics > div > .label {
                  font-size: 0.9em;
                  font-weight: 700;
                  color: rgba(0, 0, 0, 0.87);
                  text-transform: uppercase;
                  text-align: center;
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
