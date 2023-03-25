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

  const formatCorrect = (value: boolean | undefined | null): string => {
    if (value === true) return 'T'
    if (value === false) return 'F'
    return '--'
  }

  const tableData = useMemo(() => {
    if (QUESTION_GROUPS.CHOICES.includes(data.questionData.type)) {
      return (data.questionData as ChoicesQuestionData).options.choices.map(
        (choice: Choice, index: number) => {
          return {
            count: data.results[index].count,
            value: choice.value,
            correct: formatCorrect(choice.correct),
            percentage: data.participants
              ? data.results[index].count / data.participants
              : 0,
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
          correct: formatCorrect(result.correct),
          percentage: data.participants ? result.count / data.participants : 0,
        }
      })
    }
  }, [data])

  const columns = [
    { label: 'Count', accessor: 'count', sortable: true },
    {
      label: 'Value',
      accessor: 'value',
      sortable: true,
      formatter: (value: string | number) => {
        if (typeof value === 'string')
          return <Markdown content={value} className={{ img: 'max-h-32' }} />
        return value
      },
    },
    {
      label: '%',
      accessor: 'percentage',
      sortable: true,
      transformer: (value: number) => value * 100,
      formatter: (value: number) => `${String(value.toFixed())} %`,
    },
  ]

  if (showSolution)
    columns.push({ label: 'T/F', accessor: 'correct', sortable: true })

  const anythingSortable = columns.reduce(
    (acc, curr) => acc || curr.sortable,
    false
  )

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
      {anythingSortable && (
        <Button
          onClick={() => ref.current?.reset()}
          className={{ root: 'float-right' }}
        >
          <Button.Icon className={{ root: 'mr-1.5' }}>
            <FontAwesomeIcon icon={faRepeat} />
          </Button.Icon>
          <Button.Label>Reset Sorting</Button.Label>
        </Button>
      )}
    </div>
  )
}

export default TableChart
