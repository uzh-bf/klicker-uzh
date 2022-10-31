import { QuestionType } from '@klicker-uzh/prisma'
import React from 'react'
import Table from '../common/Table'

interface TableChartProps {
  questionType: QuestionType
  answers: {
    value: string | number
    count: number
    correct: boolean
  }[]
  showSolution: boolean
  totalResponses: number
}

function TableChart({
  questionType,
  answers,
  showSolution,
  totalResponses,
}: TableChartProps): React.ReactElement {
  const tableData = answers.map((answer) => {
    return {
      count: answer.count,
      // value: String.fromCharCode(65 + Number(item.value)),
      value: answer.value,
      correct: answer.correct ? 'T' : 'F',
      percentage:
        String(((answer.count / totalResponses) * 100).toFixed()) + ' %',
    }
  })

  const columns = [
    { label: 'Count', accessor: 'count', sortable: true },
    { label: 'Value', accessor: 'value', sortable: true },
    { label: '%', accessor: 'percentage', sortable: true },
  ]
  if (showSolution)
    columns.push({ label: 'T/F', accessor: 'correct', sortable: true })
  return <Table data={tableData} columns={columns}></Table>
}

export default TableChart
