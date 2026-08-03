import {
  type ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import DataTable from '../DataTable'
import EvaluationExplanation from '../evaluation/EvaluationExplanation'
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
  showExplanation: boolean
  textSize: string
  textSizeLg: string
  className?: string
}

function ElementTableChart({
  instance,
  showSolution,
  showExplanation,
  textSize,
  textSizeLg,
  className,
}: ElementTableChartProps) {
  const t = useTranslations()

  const supportedElementTypes = [
    ElementType.Sc,
    ElementType.Mc,
    ElementType.Kprim,
    ElementType.Numerical,
    ElementType.FreeText,
    ElementType.Selection,
    ElementType.Flashcard,
  ]

  const columns = useEvaluationTableColumns({
    showSolution,
    textSize,
    numericValues: instance.type === ElementType.Numerical,
    selection: instance.type === ElementType.Selection,
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
    <div className={twMerge('h-full overflow-y-auto', className)}>
      <EvaluationExplanation
        explanation={instance.explanation}
        showExplanation={showExplanation}
        textSize={textSize}
        textSizeLg={textSizeLg}
      />
      <DataTable
        isPaginated
        isResetSortingEnabled
        initialSorting={[
          { id: 'count', desc: true },
          // default ordering by value after count to fix order for elements with identical counts
          { id: 'value', desc: false },
        ]}
        columns={columns}
        data={tableData}
        csvFilename={`${instance.name}_results`}
        className={{
          tableHeader: twMerge('h-7 p-2', textSize),
          tableCell: twMerge('h-7 whitespace-break-spaces p-2', textSize),
        }}
      />
    </div>
  )
}

export default ElementTableChart
