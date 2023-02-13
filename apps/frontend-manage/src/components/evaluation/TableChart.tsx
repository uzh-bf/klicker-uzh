import { Choice, InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import { Table } from '@uzh-bf/design-system'
import React, { useMemo } from 'react'
import { QUESTION_GROUPS } from 'shared-components/src/constants'

interface TableChartProps {
  data: InstanceResult
  showSolution: boolean
  textSize: string
}

function TableChart({
  data,
  showSolution,
  textSize,
}: TableChartProps): React.ReactElement {
  const tableData = useMemo(() => {
    if (QUESTION_GROUPS.CHOICES.includes(data.questionData.type)) {
      return data.questionData.options.choices.map(
        (choice: Choice, index: number) => {
          return {
            count: data.results[index].count,
            value: choice.value,
            correct: choice.correct ? 'T' : 'F',
            percentage: data.participants
              ? String(
                  (
                    (data.results[index].count / data.participants) *
                    100
                  ).toFixed()
                ) + ' %'
              : '0 %',
          }
        }
      )
    } else {
      return Object.values(data.results).map((result) => {
        return {
          count: result.count,
          value: result.value,
          correct:
            result.correct === undefined
              ? '--'
              : result.correct === true
              ? 'T'
              : 'F',
          percentage: data.participants
            ? String(((result.count / data.participants) * 100).toFixed()) +
              ' %'
            : '0 %',
        }
      })
    }
  }, [data])

  const columns = [
    { label: 'Count', accessor: 'count', sortable: true },
    { label: 'Value', accessor: 'value', sortable: true },
    { label: '%', accessor: 'percentage', sortable: true },
  ]

  if (showSolution)
    columns.push({ label: 'T/F', accessor: 'correct', sortable: true })

  return (
    <Table
      data={tableData}
      columns={columns}
      className={{
        root: 'pb-4',
        tableHeader: textSize,
        body: textSize,
      }}
    />
  )
}

export default TableChart
