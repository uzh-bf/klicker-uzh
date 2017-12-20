import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Checkbox, Menu } from 'semantic-ui-react'

import { CommonLayout } from '.'
import { Info, Possibilities, Statistics, VisualizationType } from '../evaluation'
import { QUESTION_GROUPS } from '../../constants'

const propTypes = {
  activeInstance: PropTypes.number,
  activeVisualization: PropTypes.string.isRequired,
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
  activeVisualization,
  intl,
  pageTitle,
  showSolution,
  onToggleShowSolution,
  chart,
  type,
  description,
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
      <div className={`evaluationLayout ${type}`}>
        {instanceSummary.length > 1 && (
          <div className="instanceChooser">
            <Menu fitted tabular>
              <Menu.Item
                className="hoverable"
                disabled={activeInstance === 0}
                icon="arrow left"
                onClick={onChangeActiveInstance(activeInstance - 1)}
              />

              {instanceSummary.map(({ title, totalResponses: count }, index) => (
                <Menu.Item
                  fitted
                  active={index === activeInstance}
                  className="hoverable"
                  onClick={onChangeActiveInstance(index)}
                >
                  {title.length > 15 ? `${title.substring(0, 15)} ...` : title} ({count})
                </Menu.Item>
              ))}

              <Menu.Item
                className="hoverable"
                disabled={activeInstance + 1 === instanceSummary.length}
                icon="arrow right"
                onClick={onChangeActiveInstance(activeInstance + 1)}
              />
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
            activeVisualization={activeVisualization}
            intl={intl}
            questionType={type}
            onChangeType={onChangeVisualizationType}
          />
        </div>

        <div className="chart">{chart}</div>

        {QUESTION_GROUPS.WITH_POSSIBILITIES.includes(type) && (
          <div className="optionDisplay">
            <Possibilities questionOptions={options} questionType={type} />
          </div>
        )}

        {QUESTION_GROUPS.WITH_STATISTICS.includes(type) &&
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
                height: 100vh;
                width: 100vw;
                max-height: 100vh;
                max-width: 100vw;

                grid-template-columns: auto 17rem;
                grid-template-rows:
                  auto
                  auto
                  auto
                  auto
                  minmax(auto, 100%)
                  auto;
                grid-template-areas:
                  'instanceChooser instanceChooser'
                  'questionDetails questionDetails'
                  'graph optionDisplay'
                  'graph statistics'
                  'graph statistics'
                  'info info';

                &.FREE {
                  grid-template-areas:
                    'instanceChooser instanceChooser'
                    'questionDetails questionDetails'
                    'graph graph'
                    'graph graph'
                    'graph graph'
                    'info info';
                }

                .instanceChooser {
                  grid-area: instanceChooser;
                  padding: 0.3rem;
                  padding-bottom: 0;
                  border-bottom: 1px solid $color-primary;

                  :global(.menu) {
                    min-height: 0;
                    margin-bottom: -1px;
                    border-bottom: 1px solid $color-primary;

                    :global(.item) {
                      font-size: 0.7rem;
                      padding: 0 0.6rem;
                      margin: 0 0 -1px 0;
                      height: 2rem;
                    }

                    :global(.item.active) {
                      border-color: $color-primary;
                      background-color: $color-primary-background;
                      border-bottom: 1px solid $color-primary-background;
                    }

                    :global(.item.hoverable:hover) {
                      background-color: $color-primary-10p;
                    }
                  }
                }

                .questionDetails {
                  grid-area: questionDetails;
                  align-self: start;

                  background-color: $color-primary-background;
                  border-bottom: 1px solid $color-primary;
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
                  padding: 1rem 0.5rem 1rem 1rem;

                  :global(> *) {
                    border: 1px solid lightgrey;
                  }
                }

                .chartType {
                  padding: 1rem;
                }

                .optionDisplay,
                .statistics {
                  padding: 1rem 1rem 1rem 0.5rem;
                }

                .info {
                  grid-area: info;

                  align-self: end;

                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  justify-content: space-between;
                  border-top: 1px solid lightgrey;
                  background-color: #f3f3f3;
                  padding: 0.5rem 1rem;
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
