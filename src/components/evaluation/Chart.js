import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'
import { Button } from 'semantic-ui-react'
import { BarChart, PieChart, TableChart, CloudChart } from '.'

// TODO
const propTypes = {
  handleShowGraph: PropTypes.func.isRequired,
  results: PropTypes.shape({
    choices: PropTypes.arrayOf({
      correct: PropTypes.bool,
      count: PropTypes.number,
      name: PropTypes.string,
    }),
    totalResponses: PropTypes.number,
  }),
  showGraph: PropTypes.bool,
  showSolution: PropTypes.bool,
  visualizationType: PropTypes.string,
}

const defaultProps = {
  results: undefined,
  showGraph: false,
  showSolution: true,
  visualizationType: 'TABLE',
}

const chartTypes = {
  BAR_CHART: BarChart,
  PIE_CHART: PieChart,
  TABLE: TableChart,
  WORD_CLOUD: CloudChart,
}

function Chart({
  results, handleShowGraph, showGraph, showSolution, visualizationType,
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
                  id="teacher.evaluation.graph.showGraph"
                  defaultMessage="Show Graph"
                />
              </Button>
            </div>
          )
        }

        const ChartComponent = chartTypes[visualizationType]
        if (ChartComponent) {
          return <ChartComponent isSolutionShown={showSolution} data={results.data} />
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
