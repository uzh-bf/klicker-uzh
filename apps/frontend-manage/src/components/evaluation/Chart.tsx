import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { SizeMe } from 'react-sizeme'

import { SESSION_STATUS } from '../../constants'
import BarChart from './charts/BarChart'
import CloudChart from './charts/CloudChart'
import HistogramChart from './charts/HistogramChart'
import PieChart from './charts/PieChart'
import StackChart from './charts/StackChart'
import TableChart from './charts/TableChart'

interface Props {
  activeVisualization: string
  data?: {
    correct?: boolean
    count: number
    name: string
    percentage: number
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
  showGraph?: boolean
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
  data,
  instanceId,
  isPublic,
  restrictions,
  handleShowGraph,
  numBins,
  questionType,
  sessionId,
  sessionStatus,
  showGraph,
  showSolution,
  statistics,
  totalResponses,
}: Props): React.ReactElement {
  return (
    <div className="w-full h-full chart">
      {((): React.ReactElement => {
        // if the chart display has not already been toggled
        if (!showGraph) {
          return (
            <div className="flex items-center justify-center h-full">
              <Button
                className="border-solid bg-uzh-grey-20 border-1"
                onClick={handleShowGraph}
              >
                <Button.Label>Diagramm anzeigen</Button.Label>
              </Button>
            </div>
          )
        }

        if (totalResponses === 0) {
          return (
            <div className="flex items-center justify-center h-full">
              Keine Resultate verfügbar.
            </div>
          )
        }

        const ChartComponent = chartTypes[activeVisualization]
        if (ChartComponent) {
          return (
            <SizeMe refreshRate={250}>
              {({ size }): React.ReactElement => (
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
              )}
            </SizeMe>
          )
        }

        return <div>This chart type is not implemented yet.</div>
      })()}
    </div>
  )
}

Chart.defaultProps = defaultProps

export default Chart
