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

function Chart({
  results, handleShowGraph, showGraph, showSolution, visualizationType,
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

        switch (visualizationType) {
          case 'TABLE':
            return <TableChart data={results.data} />

          case 'PIE_CHART':
            return <PieChart isSolutionShown={showSolution} data={results.data} />

          case 'BAR_CHART':
            return <BarChart isSolutionShown={showSolution} data={results.data} />

          case 'WORD_CLOUD':
            return <CloudChart data={results.data} />

          default:
            return <div>This type of graph is not implemented yet!</div>
        }
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
