import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Markdown } from '@klicker-uzh/markdown'
import { Progress } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import TableSortingButton from '../TableSortingButton'

interface UseEvaluationTableColumnsProps {
  showSolution: boolean
  textSize: string
  numericValues?: boolean
  selection?: boolean
}

function useEvaluationTableColumns({
  showSolution,
  textSize,
  numericValues = false,
  selection = false,
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
              className={textSize}
              title={t('manage.evaluation.count')}
            />
          )
        },
        displayName: t('manage.evaluation.count'),
        className: 'w-10',
      },
      {
        header: numericValues
          ? ({ column }: any) => {
              return (
                <TableSortingButton
                  column={column}
                  className={textSize}
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
        displayName: t('manage.evaluation.value'),
      },
      {
        header: ({ column }: any) => {
          return (
            <TableSortingButton
              column={column}
              className={textSize}
              title="%"
            />
          )
        },
        accessorKey: 'percentage',
        cell: ({ row }: any) => {
          const amount = parseFloat(row.getValue('percentage')) * 100
          return `${String(amount.toFixed())} %`
        },
        displayName: '%',
        className: 'w-20',
      },
      ...(selection
        ? [
            {
              header: ({ column }: any) => {
                return (
                  <TableSortingButton
                    column={column}
                    className={textSize}
                    title={t('manage.evaluation.selection')}
                  />
                )
              },
              accessorKey: 'selectionRate',
              cell: ({ row }: any) => {
                const value = row.getValue('selectionRate')
                const correctness = showSolution
                  ? row.original['correct']
                  : undefined

                return (
                  <Progress
                    value={value}
                    max={100}
                    formatter={() => null}
                    className={{
                      root: 'h-4 rounded-lg',
                      background: 'rounded-lg',
                      indicator: twMerge(
                        'min-w-0 rounded-lg px-0',
                        typeof correctness === 'boolean' && 'bg-red-600',
                        typeof correctness === 'boolean' &&
                          correctness === true &&
                          'bg-green-600'
                      ),
                    }}
                  />
                )
              },
              displayName: t('shared.generic.correctness'),
              className: 'w-80',
            },
          ]
        : []),
      ...(showSolution
        ? [
            {
              header: ({ column }: any) => {
                return (
                  <TableSortingButton
                    column={column}
                    className={textSize}
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
              displayName: t('shared.generic.correctness'),
              className: 'w-14',
            },
          ]
        : []),
    ],
    [showSolution, numericValues, selection, textSize, t]
  )

  return columns
}

export default useEvaluationTableColumns
