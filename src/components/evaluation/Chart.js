import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'
import { Button } from 'semantic-ui-react'
import { BarChart, PieChart } from '.'

// TODO
const propTypes = {
  handleShowGraph: PropTypes.func.isRequired,
  results: PropTypes.shape({
    options: PropTypes.arrayOf({
      correct: PropTypes.bool,
      name: PropTypes.string,
      numberOfVotes: PropTypes.number,
    }),
    totalResponses: PropTypes.number,
  }),
  showGraph: PropTypes.bool,
  showSolution: PropTypes.bool,
  visualization: PropTypes.string,
}

const defaultProps = {
  results: undefined,
  showGraph: false,
  showSolution: true,
  visualization: 'PIE_CHART',
}

function Chart({
  handleShowGraph, results, showGraph, showSolution, visualization,
}) {
  return (
    <div className="chart">
      {(() => {
        // if the chart display has not already been toggled
        if (!showGraph) {
          return (
            <Button className="showGraphButton" onClick={handleShowGraph}>
              <FormattedMessage
                id="teacher.evaluation.graph.showGraph"
                defaultMessage="Show Graph"
              />
            </Button>
          )
        }

        // pie charts
        if (visualization === 'PIE_CHART') {
          return <PieChart isSolutionShown={showSolution} results={results} />
        }

        // bar charts
        if (visualization === 'BAR_CHART') {
          return <BarChart isSolutionShown={showSolution} results={results} />
        }

        // default
        return <div>This type of graph is not implemented yet!</div>
      })()}

      <style jsx>{`
        .chart {
          display: flex;
          justify-content: center;
          align-items: center;

          height: 100%;
          width: 100%;
        }
      `}</style>
    </div>
  )
}

Chart.propTypes = propTypes
Chart.defaultProps = defaultProps

export default Chart
