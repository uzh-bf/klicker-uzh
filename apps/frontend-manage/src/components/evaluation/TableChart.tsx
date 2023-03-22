import { faRepeat } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Choice,
  ChoicesQuestionData,
  FreeTextQuestionData,
  InstanceResult,
  NumericalQuestionData,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { Button, Table } from '@uzh-bf/design-system'
import React, { useMemo, useRef } from 'react'
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
  const ref = useRef<{ reset: () => void }>(null)

  const tableData = useMemo(() => {
    if (QUESTION_GROUPS.CHOICES.includes(data.questionData.type)) {
      return (data.questionData as ChoicesQuestionData).options.choices.map(
        (choice: Choice, index: number) => {
          return {
            count: data.results[index].count,
            value: (
              <Markdown
                content={choice.value}
                className={{ img: 'max-h-32' }}
              />
            ),
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
      return Object.values(
        data.results as FreeTextQuestionData | NumericalQuestionData
      ).map((result) => {
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
    <div>
      <Table
        ref={ref}
        data={tableData}
        columns={columns}
        className={{
          root: 'pb-4',
          tableHeader: textSize,
          body: `${textSize}`,
        }}
      />
      <Button
        onClick={() => ref.current?.reset()}
        className={{ root: 'float-right' }}
      >
        <Button.Icon className={{ root: 'mr-1.5' }}>
          <FontAwesomeIcon icon={faRepeat} />
        </Button.Icon>
        <Button.Label>Reset Filters</Button.Label>
      </Button>
    </div>
  )
}

export default TableChart
