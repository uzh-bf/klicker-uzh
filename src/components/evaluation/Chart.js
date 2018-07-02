import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'
import { Button } from 'semantic-ui-react'

import {
  BarChart,
  StackChart,
  PieChart,
  TableChart,
  CloudChart,
  HistogramChart,
} from '.'
import { SESSION_STATUS } from '../../constants'
import { statisticsShape } from '../../propTypes'

// TODO
const propTypes = {
  activeVisualization: PropTypes.string.isRequired,
  data: PropTypes.arrayOf({
    correct: PropTypes.bool,
    count: PropTypes.number,
    name: PropTypes.string,
    percentage: PropTypes.number,
  }),
  handleShowGraph: PropTypes.func.isRequired,
  numBins: PropTypes.number.isRequired,
  questionType: PropTypes.string.isRequired,
  restrictions: PropTypes.shape({
    max: PropTypes.number,
    min: PropTypes.number,
  }),
  sessionStatus: PropTypes.string.isRequired,
  showGraph: PropTypes.bool,
  showSolution: PropTypes.bool,
  statistics: statisticsShape,
  totalResponses: PropTypes.number,
}

const defaultProps = {
  data: undefined,
  restrictions: undefined,
  showGraph: false,
  showSolution: true,
  statistics: undefined,
  totalResponses: undefined,
}

const chartTypes = {
  BAR_CHART: BarChart,
  HISTOGRAM: HistogramChart,
  PIE_CHART: PieChart,
  STACK_CHART: StackChart,
  TABLE: TableChart,
  WORD_CLOUD: CloudChart,
}

function Chart({
  activeVisualization,
  data,
  restrictions,
  handleShowGraph,
  numBins,
  questionType,
  sessionStatus,
  showGraph,
  showSolution,
  statistics,
  totalResponses,
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
                  id="evaluation.graph.showGraph"
                />
              </Button>
            </div>
          )
        }

        if (totalResponses === 0) {
          return (
            <div className="noChart">
              <FormattedMessage
                defaultMessage="No Results Available"
                id="evaluation.graph.noResults"
              />
            </div>
          )
        }

        const ChartComponent = chartTypes[activeVisualization]
        if (ChartComponent) {
          return (
            <ChartComponent
              brush={sessionStatus !== SESSION_STATUS.RUNNING}
              data={data}
              isColored={questionType !== 'FREE_RANGE'}
              isSolutionShown={showSolution}
              numBins={numBins}
              questionType={questionType}
              restrictions={restrictions}
              statistics={statistics}
              totalResponses={totalResponses}
            />
          )
        }

        return (
          <div>
This chart type is not implemented yet.
          </div>
        )
      })()}

      <style jsx>
        {`
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
        `}
      </style>
    </div>
  )
}

Chart.propTypes = propTypes
Chart.defaultProps = defaultProps

export default Chart
