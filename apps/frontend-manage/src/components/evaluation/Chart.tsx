import {
  NumericalRestrictions,
  NumericalSolutionRange,
} from '@klicker-uzh/graphql/dist/ops'
import React from 'react'
import BarChart from './BarChart'
import Histogram from './Histogram'
import TableChart from './TableChart'
import Wordcloud from './Wordcloud'

interface ChartProps {
  chartType: string
  data: {
    answers: any
    blockIx: number
    instanceIx: number
    content: string
    type: string
    participants: number
    restrictions?: NumericalRestrictions // Only in NUMERICAL
    solutions?: {
      solutionRanges?: NumericalSolutionRange[] // Only in NUMERICAL
      freeTextSolutions?: string[] // Only in FREE_TEXT
    }
  }[]

  showSolution: boolean
}

function Chart({
  chartType,
  data,
  showSolution,
}: ChartProps): React.ReactElement {
  if (chartType === 'table') {
    // TODO: add resizing possibility with sizeMe: <SizeMe refreshRate={250}>{({ size }) => <Component />}</SizeMe>
    return (
      <TableChart
        answers={data.answers}
        questionType={data.type}
        showSolution={showSolution}
        totalResponses={data.participants}
      />
    )
  } else if (chartType === 'histogram') {
    return (
      <Histogram
        answers={data.answers}
        min={data.restrictions.min}
        max={data.restrictions.max}
      />
    )
  } else if (chartType === 'wordCloud') {
    return (
      <Wordcloud
        data={data.answers.map((answer) => ({
          value: answer.value,
          count: answer.count,
        }))}
      />
    )
  } else if (chartType === 'barChart') {
    return (
      <BarChart
        answers={data.answers}
        questionType={data.type}
        showSolution={showSolution}
        totalResponses={data.participants}
      />
    )
  } else {
    return <div>There exists no chart for this question type yet</div>
  }
}

export default Chart
