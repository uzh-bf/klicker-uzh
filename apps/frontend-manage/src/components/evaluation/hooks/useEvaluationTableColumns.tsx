import {
  faCheck,
  faSort,
  faSortDown,
  faSortUp,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Markdown } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

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

  const SortingButton = ({
    column,
    title,
    buttonTextSize,
  }: {
    column: any
    title: string
    buttonTextSize: string
  }) => {
    return (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className={twMerge('h-7 !pl-0 hover:bg-transparent', buttonTextSize)}
      >
        {title}
        <FontAwesomeIcon
          icon={
            column.getIsSorted() === 'asc'
              ? faSortUp
              : column.getIsSorted() === 'desc'
                ? faSortDown
                : faSort
          }
          className="ml-2 h-3 w-3"
        />
      </Button>
    )
  }

  const columns = useMemo(
    () => [
      {
        accessorKey: 'count',
        header: ({ column }: any) => {
          return (
            <SortingButton
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
                <SortingButton
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
            <SortingButton
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
                  <SortingButton
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
