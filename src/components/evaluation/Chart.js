import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'
import { Button } from 'semantic-ui-react'

import { BarChart, StackChart, PieChart, TableChart, CloudChart, HistogramChart } from '.'
import { SESSION_STATUS } from '../../constants'
import { statisticsShape } from '../../propTypes'

// TODO
const propTypes = {
  activeVisualization: PropTypes.string.isRequired,
  handleShowGraph: PropTypes.func.isRequired,
  restrictions: PropTypes.shape({
    max: PropTypes.number,
    min: PropTypes.number,
  }),
  results: PropTypes.shape({
    choices: PropTypes.arrayOf({
      correct: PropTypes.bool,
      count: PropTypes.number,
      name: PropTypes.string,
    }),
    totalResponses: PropTypes.number,
  }),
  sessionStatus: PropTypes.string.isRequired,
  showGraph: PropTypes.bool,
  showSolution: PropTypes.bool,
  statistics: statisticsShape,
}

const defaultProps = {
  restrictions: undefined,
  results: undefined,
  showGraph: false,
  showSolution: true,
  statistics: undefined,
}

const chartTypes = {
  BAR_CHART: BarChart,
  STACK_CHART: StackChart,
  HISTOGRAM: HistogramChart,
  PIE_CHART: PieChart,
  TABLE: TableChart,
  WORD_CLOUD: CloudChart,
}

function Chart({
  activeVisualization,
  restrictions,
  results,
  handleShowGraph,
  sessionStatus,
  showGraph,
  showSolution,
  statistics,
}) {
  return (
    <div className="chart">
      {(() => {
        // if the chart display has not already been toggled
        if (!showGraph) {
          return (
            <div className="noChart">
              <Button className="showGraphButton" onClick={handleShowGraph}>
                <FormattedMessage
                  defaultMessage="Show Graph"
                  id="teacher.evaluation.graph.showGraph"
                />
              </Button>
            </div>
          )
        }

        if (results.totalResponses === 0) {
          return (
            <div className="noChart">
              <FormattedMessage
                defaultMessage="No Results Available"
                id="teacher.evaluation.graph.noResults"
              />
            </div>
          )
        }

        const ChartComponent = chartTypes[activeVisualization]
        if (ChartComponent) {
          return (
            <ChartComponent
              brush={sessionStatus !== SESSION_STATUS.RUNNING}
              data={results.data}
              isSolutionShown={showSolution}
              restrictions={restrictions}
              statistics={statistics}
              totalResponses={results.totalResponses}
            />
          )
        }

        return <div>This chart type is not implemented yet.</div>
      })()}

      <style jsx>{`
        .chart {
          height: 100%;
          width: 100%;

          .noChart {
            display: flex;
            justify-content: center;
            align-items: center;

            height: 100%;
          }
        }
      `}</style>
    </div>
  )
}

Chart.propTypes = propTypes
Chart.defaultProps = defaultProps

export default Chart
