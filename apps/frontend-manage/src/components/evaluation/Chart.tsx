import { QuestionType } from '@klicker-uzh/prisma'
import React from 'react'
import BarChart from './BarChart'
import Histogram from './Histogram'
import Wordcloud from './Wordcloud'

interface ChartProps {
  questionType: QuestionType
  data: { value: string | number; correct: boolean; votes: number }[]
  showSolution: boolean
}

const defaultValues = {}

function Chart({
  questionType,
  data,
  showSolution,
}: ChartProps): React.ReactElement {
  const totalResponses = data.reduce((acc, curr) => acc + curr.votes, 0)

  if (
    questionType === 'SC' ||
    questionType === 'MC' ||
    questionType === 'KPRIM'
  ) {
    // TODO: add resizing possibility with sizeMe: <SizeMe refreshRate={250}>{({ size }) => <Component />}</SizeMe>
    return (
      <BarChart
        data={data}
        questionType={questionType}
        showSolution={showSolution}
        totalResponses={totalResponses}
      />
    )
  } else if (questionType === 'NUMERICAL') {
    return <Histogram data={data} numBins={20} />
  } else if (questionType === 'FREE_TEXT') {
    return <Wordcloud data={data} />
  } else {
    return <div>There exists no chart for this question type yet</div>
  }
}

export default Chart
