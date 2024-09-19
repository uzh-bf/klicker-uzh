import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Markdown } from '@klicker-uzh/markdown'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { EvaluationTableRowType } from '../charts/ElementTableChart'

interface UseEvaluationTableColumnsProps {
  showSolution: boolean
}

function useEvaluationTableColumns({
  showSolution,
}: UseEvaluationTableColumnsProps) {
  const t = useTranslations()

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
        formatter: ({ row }: { row: EvaluationTableRowType }) => {
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
        transformer: ({ row }: { row: EvaluationTableRowType }) =>
          row['percentage'] * 100,
        formatter: ({ row }: { row: EvaluationTableRowType }) =>
          `${String(row['percentage'].toFixed())} %`,
      },
      ...(showSolution
        ? [
            {
              label: 'T/F',
              accessor: 'correct',
              sortable: false,
              formatter: ({ row }: { row: EvaluationTableRowType }) => {
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

  return columns
}

export default useEvaluationTableColumns
