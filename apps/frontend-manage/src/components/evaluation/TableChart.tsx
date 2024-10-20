import { faCheck, faRepeat, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Choice,
  FreeTextQuestionData,
  InstanceResult,
  NumericalQuestionData,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import { Button, Table } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useMemo, useRef } from 'react'

type RowType = {
  count: number
  value: string | number
  correct: boolean
  percentage: number
}

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
  const t = useTranslations()
  const ref = useRef<{ reset: () => void }>(null)
  const questionData = data.questionData

  const tableData = useMemo(() => {
    if (questionData.__typename === 'ChoicesQuestionData') {
      return questionData.options.choices.map(
        (choice: Choice, index: number) => {
          return {
            count: data.results[index].count,
            value: choice.value,
            correct: choice.correct,
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
          correct: result.correct,
          percentage: data.participants ? result.count / data.participants : 0,
        }
      })
    }
  }, [data])

  const columns = useMemo(
    () => [
      {
        label: t('manage.evaluation.count'),
        accessor: 'count',
        sortable: true,
      },
      {
        label: t('manage.evaluation.value'),
        accessor: 'value',
        sortable: true,
        formatter: ({ row }: { row: RowType }) => {
          if (typeof row['value'] === 'string')
            return (
              <Markdown
                content={row['value']}
                className={{ img: 'max-h-32' }}
              />
            )
          return row['value']
        },
      },
      {
        label: '%',
        accessor: 'percentage',
        sortable: true,
        transformer: ({ row }: { row: RowType }) => row['percentage'] * 100,
        formatter: ({ row }: { row: RowType }) =>
          `${String(row['percentage'].toFixed())} %`,
      },
      ...(showSolution
        ? [
            {
              label: 'T/F',
              accessor: 'correct',
              sortable: false,
              formatter: ({ row }: { row: RowType }) => {
                if (row['correct'] === true)
                  return (
                    <FontAwesomeIcon
                      icon={faCheck}
                      className="text-green-700"
                    />
                  )
                if (row['correct'] === false)
                  return <FontAwesomeIcon icon={faX} className="text-red-600" />
                return <>--</>
              },
            },
          ]
        : []),
    ],
    [showSolution, t]
  )

  const anythingSortable = columns.reduce(
    (acc, curr) => acc || curr.sortable,
    false
  )

  return (
    <div>
      <Table
        key={data.id}
        forwardedRef={ref}
        data={tableData}
        columns={columns}
        className={{
          root: 'pb-4',
          tableHeader: textSize,
          body: `${textSize}`,
        }}
        defaultSortField={
          !QUESTION_GROUPS.CHOICES.includes(questionData.type)
            ? 'count'
            : undefined
        }
        defaultSortOrder={
          !QUESTION_GROUPS.CHOICES.includes(questionData.type)
            ? 'desc'
            : undefined
        }
      />
      {anythingSortable && (
        <Button
          onClick={() => ref.current?.reset()}
          className={{ root: 'float-right' }}
          data={{ cy: 'reset-table-chart-sorting' }}
        >
          <Button.Icon className={{ root: 'mr-1.5' }}>
            <FontAwesomeIcon icon={faRepeat} />
          </Button.Icon>
          <Button.Label>{t('manage.evaluation.resetSorting')}</Button.Label>
        </Button>
      )}
    </div>
  )
}

export default TableChart
