import React from 'react'
import { FormattedMessage } from 'react-intl'
import { Button } from 'semantic-ui-react'
import { SizeMe } from 'react-sizeme'

import BarChart from './charts/BarChart'
import StackChart from './charts/StackChart'
import PieChart from './charts/PieChart'
import TableChart from './charts/TableChart'
import CloudChart from './charts/CloudChart'
import HistogramChart from './charts/HistogramChart'
import ConfusionBarometerChart from './charts/ConfusionBarometerChart'
import FeedbackTableChart from './charts/FeedbackTableChart'

import { SESSION_STATUS } from '../../constants'

// TODO
interface Props {
  activeVisualization: string
  confusionTS?: {
    difficulty: number
    speed: number
    createdAt: string
  }[]
  data?: {
    correct?: boolean
    count: number
    name: string
    percentage: number
  }[]
  feedback?: {
    content: string
    votes: any
  }[]
  handleShowGraph: any
  instanceId: string
  isPublic: boolean
  numBins: number
  questionType: string
  restrictions?: {
    max: number
    min: number
  }
  sessionId: string
  sessionStatus: string
  showConfusionTS: boolean
  showFeedback: boolean
  showGraph?: boolean
  showQuestionLayout: boolean
  showSolution?: boolean
  statistics?: {
    max: number
    mean: number
    median: number
    min: number
  }
  totalResponses?: number
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
  CLOUD_CHART: CloudChart,
  HISTOGRAM: HistogramChart,
  PIE_CHART: PieChart,
  STACK_CHART: StackChart,
  TABLE: TableChart,
}

function Chart({
  activeVisualization,
  confusionTS,
  data,
  feedback,
  instanceId,
  isPublic,
  restrictions,
  handleShowGraph,
  numBins,
  questionType,
  sessionId,
  sessionStatus,
  showConfusionTS,
  showFeedback,
  showGraph,
  showQuestionLayout,
  showSolution,
  statistics,
  totalResponses,
}: Props): React.ReactElement {
  return (
    <div className="chart">
      {((): React.ReactElement => {
        // if the chart display has not already been toggled
        if (!showGraph) {
          return (
            <div className="noChart">
              <Button className="showGraphButton" onClick={handleShowGraph}>
                <FormattedMessage defaultMessage="Show Graph" id="evaluation.graph.showGraph" />
              </Button>
            </div>
          )
        }

        if (totalResponses === 0 && !(showConfusionTS || showFeedback)) {
          return (
            <div className="noChart">
              <FormattedMessage defaultMessage="No Results Available" id="evaluation.graph.noResults" />
            </div>
          )
        }

        const ChartComponent = chartTypes[activeVisualization]
        if (ChartComponent) {
          return (
            <SizeMe refreshRate={250}>
              {({ size }): React.ReactElement =>
                (showQuestionLayout && (
                  <ChartComponent
                    brush={sessionStatus !== SESSION_STATUS.RUNNING}
                    data={data}
                    instanceId={instanceId}
                    isColored={questionType !== 'FREE_RANGE'}
                    isPublic={isPublic}
                    isSolutionShown={showSolution}
                    numBins={numBins}
                    questionType={questionType}
                    restrictions={restrictions}
                    sessionId={sessionId}
                    size={size}
                    statistics={statistics}
                    totalResponses={totalResponses}
                  />
                )) ||
                (showConfusionTS && <ConfusionBarometerChart confusionTS={confusionTS} />) ||
                (showFeedback && <FeedbackTableChart feedback={feedback} />)
              }
            </SizeMe>
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

Chart.defaultProps = defaultProps

export default Chart
