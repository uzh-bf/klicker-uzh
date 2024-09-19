import { faRepeat } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import { Button, Table, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import useEvaluationTableColumns from '../hooks/useEvaluationTableColumns'
import useEvaluationTableData from '../hooks/useEvaluationTableData'

export type EvaluationTableRowType = {
  count: number
  value: string | number
  correct: boolean
  percentage: number
}

interface ElementTableChartProps {
  instance: ElementInstanceEvaluation
  showSolution: boolean
  textSize: string
}

function ElementTableChart({
  instance,
  showSolution,
  textSize,
}: ElementTableChartProps) {
  const t = useTranslations()
  const ref = useRef<{ reset: () => void }>(null)

  const supportedElementTypes = [
    ElementType.Sc,
    ElementType.Mc,
    ElementType.Kprim,
    ElementType.Numerical,
    ElementType.FreeText,
  ]

  const columns = useEvaluationTableColumns({ showSolution })
  const tableData: EvaluationTableRowType[] = useEvaluationTableData({
    instance,
  })

  if (!supportedElementTypes.includes(instance.type)) {
    return (
      <UserNotification type="warning">
        {t('manage.evaluation.chartTypeNotSupported')}
      </UserNotification>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div>
        <Table
          key={instance.id}
          forwardedRef={ref}
          data={tableData}
          columns={columns}
          className={{
            root: 'pb-4',
            tableHeader: textSize,
            body: `${textSize}`,
          }}
          defaultSortField={
            !QUESTION_GROUPS.CHOICES.includes(instance.type)
              ? 'count'
              : undefined
          }
          defaultSortOrder={
            !QUESTION_GROUPS.CHOICES.includes(instance.type)
              ? 'desc'
              : undefined
          }
        />

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
      </div>
    </div>
  )
}

export default ElementTableChart
