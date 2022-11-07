import React from 'react'
import BarChart from './BarChart'
import Histogram from './Histogram'
import TableChart from './TableChart'
import Wordcloud from './Wordcloud'

interface ChartProps {
  chartType: string
  data:
    | {
        type: 'SC' | 'MC' | 'KPRIM'
        content: string
        blockIx: number
        instanceIx: number
        participants: number
        answers: { value: string; correct: boolean; count: number }[]
      } // choices question types
    | {
        type: 'FREE_TEXT'
        content: string
        blockIx: number
        instanceIx: number
        participants: number
        answers: { value: string; count: number }[]
        solutions: string[]
      } // free text question type
    | {
        type: 'NUMERICAL'
        content: string
        blockIx: number
        instanceIx: number
        participants: number
        answers: { value: string; count: number }[]
        restrictions: { min?: number; max?: number }
        solutions: { min?: number; max?: number }[]
      }

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
