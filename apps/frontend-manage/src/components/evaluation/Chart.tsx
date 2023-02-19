import { InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import React from 'react'
import { TextSizeType } from '../sessions/evaluation/constants'
import BarChart from './BarChart'
import Histogram from './Histogram'
import TableChart from './TableChart'
import Wordcloud from './Wordcloud'

interface ChartProps {
  chartType: string
  data: InstanceResult
  showSolution: boolean
  textSize: TextSizeType
  statisticsShowSolution?: {
    mean?: boolean
    median?: boolean
    q1?: boolean
    q3?: boolean
    sd?: boolean
  }
}

function Chart({
  chartType,
  data,
  showSolution,
  textSize,
  statisticsShowSolution,
}: ChartProps): React.ReactElement {
  if (chartType === 'table') {
    // TODO: add resizing possibility with sizeMe: <SizeMe refreshRate={250}>{({ size }) => <Component />}</SizeMe>
    return (
      <div className="h-full overflow-y-auto">
        <TableChart
          data={data}
          showSolution={showSolution}
          textSize={textSize.textLg}
        />
      </div>
    )
  } else if (chartType === 'histogram') {
    return (
      <Histogram
        data={data}
        showSolution={{ general: showSolution, ...statisticsShowSolution }}
        textSize={textSize.text}
      />
    )
  } else if (chartType === 'wordCloud') {
    return (
      <Wordcloud
        data={data}
        showSolution={showSolution}
        textSize={{ min: textSize.min, max: textSize.max }}
      />
    )
  } else if (chartType === 'barChart') {
    return (
      <BarChart
        data={data}
        showSolution={showSolution}
        textSize={{
          textXl: textSize.textXl,
          text2Xl: textSize.text2Xl,
          text3Xl: textSize.text3Xl,
          legend: textSize.legend,
        }}
      />
    )
  } else {
    return <div>There exists no chart for this question type yet</div>
  }
}

export default Chart
