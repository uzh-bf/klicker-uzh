import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'
import { Button } from 'semantic-ui-react'

import { BarChart, PieChart, TableChart, CloudChart, HistogramChart } from '.'
import { statisticsShape } from '../../propTypes'

// TODO
const propTypes = {
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
  SESSION_STATUS: PropTypes.string.isRequired,
  showGraph: PropTypes.bool,
  showSolution: PropTypes.bool,
  statistics: statisticsShape,
  visualizationType: PropTypes.string,
}

const defaultProps = {
  restrictions: undefined,
  results: undefined,
  showGraph: false,
  showSolution: true,
  statistics: undefined,
  visualizationType: 'TABLE',
}

const chartTypes = {
  BAR_CHART: BarChart,
  HISTOGRAM: HistogramChart,
  PIE_CHART: PieChart,
  TABLE: TableChart,
  WORD_CLOUD: CloudChart,
}

function Chart({
  restrictions,
  results,
  handleShowGraph,
  SESSION_STATUS,
  showGraph,
  showSolution,
  statistics,
  visualizationType,
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

        const ChartComponent = chartTypes[visualizationType]
        if (ChartComponent) {
          return (
            <ChartComponent
              brush={SESSION_STATUS !== 'RUNNING'}
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
