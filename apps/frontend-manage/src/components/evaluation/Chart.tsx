import { QuestionType } from '@klicker-uzh/prisma'
import React from 'react'
import Histogram from './Histogram'
import TableChart from './TableChart'
import Wordcloud from './Wordcloud'

interface ChartProps {
  questionType: QuestionType
  data: { value: string | number; correct: boolean; votes: number }[]
  showSolution: boolean
  options?: any
  totalResponses: number
}

const defaultValues = {}

function Chart({
  questionType,
  data,
  showSolution,
  options,
  totalResponses,
}: ChartProps): React.ReactElement {
  if (
    questionType === 'SC' ||
    questionType === 'MC' ||
    questionType === 'KPRIM'
  ) {
    // TODO: add resizing possibility with sizeMe: <SizeMe refreshRate={250}>{({ size }) => <Component />}</SizeMe>
    return (
      <TableChart
        data={data}
        questionType={questionType}
        showSolution={showSolution}
        totalResponses={totalResponses}
      />
    )
  } else if (questionType === 'NUMERICAL') {
    return (
      <Histogram
        data={data}
        min={options?.restrictions?.min}
        max={options?.restrictions?.max}
      />
    )
  } else if (questionType === 'FREE_TEXT') {
    return <Wordcloud data={data} />
  } else {
    return <div>There exists no chart for this question type yet</div>
  }
}

export default Chart
