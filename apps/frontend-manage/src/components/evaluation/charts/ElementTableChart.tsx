import DataTable from '@components/common/DataTable'
import {
  ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
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

  const columns = useEvaluationTableColumns({
    showSolution,
    numericValues: instance.type === ElementType.Numerical,
  })
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
        <DataTable
          isPaginated
          isResetSortingEnabled
          columns={columns}
          data={tableData}
          csvFilename={`${instance.name}_results`}
          className={{
            tableHeader: 'h-7 p-2',
            tableCell: 'h-7 p-2',
          }}
        />
      </div>
    </div>
  )
}

export default ElementTableChart
