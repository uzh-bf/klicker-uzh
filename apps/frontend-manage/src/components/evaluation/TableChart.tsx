import { QuestionType } from '@klicker-uzh/prisma'
import React from 'react'
import Table from '../common/Table'

interface TableChartProps {
  questionType: QuestionType
  data: {
    value: string | number
    answer: Record<string, string>
    votes: number
  }[]
  showSolution: boolean
  totalResponses: number
}

function TableChart({
  questionType,
  data,
  showSolution,
  totalResponses,
}: TableChartProps): React.ReactElement {
  const tableData = data.map((item) => {
    console.log('correct', item.answer.correct)
    return {
      count: item.votes,
      value: String.fromCharCode(65 + Number(item.value)),
      correct: item.answer.correct ? 'T' : 'F',
      percentage:
        String(((item.votes / totalResponses) * 100).toFixed()) + ' %',
    }
  })

  const columns = [
    { label: 'Count', accessor: 'count', sortable: true },
    { label: 'Value', accessor: 'value', sortable: true },
    { label: '%', accessor: 'percentage', sortable: true },
  ]
  if (showSolution)
    columns.push({ label: 'T/F', accessor: 'correct', sortable: true })

  console.log('render table')
  console.log(tableData)
  return <Table data={tableData} columns={columns}></Table>
}

export default TableChart
