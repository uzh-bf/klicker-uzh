import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Markdown } from '@klicker-uzh/markdown'
import { useTranslations } from 'next-intl'
import React, { useMemo } from 'react'
import { TableSortingButton } from 'src/DataTable'

interface UseEvaluationTableColumnsProps {
  showSolution: boolean
  textSize: string
  numericValues?: boolean
}

function useEvaluationTableColumns({
  showSolution,
  textSize,
  numericValues = false,
}: UseEvaluationTableColumnsProps) {
  const t = useTranslations()

  const columns = useMemo(
    () => [
      {
        accessorKey: 'count',
        header: ({ column }: any) => {
          return (
            <TableSortingButton
              column={column}
              buttonTextSize={textSize}
              title={t('manage.evaluation.count')}
            />
          )
        },
        className: 'w-10',
      },
      {
        header: numericValues
          ? ({ column }: any) => {
              return (
                <TableSortingButton
                  column={column}
                  buttonTextSize={textSize}
                  title={t('manage.evaluation.value')}
                />
              )
            }
          : t('manage.evaluation.value'),
        accessorKey: 'value',
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
        header: ({ column }: any) => {
          return (
            <TableSortingButton
              column={column}
              buttonTextSize={textSize}
              title="%"
            />
          )
        },
        accessorKey: 'percentage',
        cell: ({ row }: any) => {
          const amount = parseFloat(row.getValue('percentage')) * 100
          return `${String(amount.toFixed())} %`
        },
        className: 'w-20',
      },
      ...(showSolution
        ? [
            {
              header: ({ column }: any) => {
                return (
                  <TableSortingButton
                    column={column}
                    buttonTextSize={textSize}
                    title="T/F"
                  />
                )
              },
              accessorKey: 'correct',
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
              className: 'w-14',
            },
          ]
        : []),
    ],
    [showSolution, numericValues, textSize, t]
  )

  return columns
}

export default useEvaluationTableColumns
