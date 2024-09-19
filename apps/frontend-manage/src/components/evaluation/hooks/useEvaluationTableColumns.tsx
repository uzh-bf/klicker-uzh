import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Markdown } from '@klicker-uzh/markdown'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

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
        header: t('manage.evaluation.count'),
        accessorKey: 'count',
        sortable: true,
      },
      {
        header: t('manage.evaluation.value'),
        accessorKey: 'value',
        sortable: true,
        cell: ({ row }: any) => {
          if (typeof row.getValue('value') === 'string')
            return (
              <Markdown
                content={row.getValue('value')}
                className={{ img: 'max-h-32' }}
              />
            )
          return row.getValue('value')
        },
      },
      {
        header: '%',
        accessorKey: 'percentage',
        sortable: true,
        cell: ({ row }: any) => {
          const amount = parseFloat(row.getValue('percentage')) * 100
          return `${String(amount.toFixed())} %`
        },
      },
      ...(showSolution
        ? [
            {
              header: 'T/F',
              accessorKey: 'correct',
              sortable: false,
              cell: ({ row }: any) => {
                if (row.getValue('correct') === true)
                  return (
                    <FontAwesomeIcon
                      icon={faCheck}
                      className="text-green-700"
                    />
                  )
                if (row.getValue('correct') === false)
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
