import { AdaptiveItemCalibrationStatus } from '@klicker-uzh/graphql/dist/ops'
import { Badge } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import type { ItemBankCalibrationStatus } from './itemBankMapModel'

const STATUS_CLASSES: Record<ItemBankCalibrationStatus, string> = {
  CALIBRATED: 'border-green-700 bg-green-50 text-green-900',
  PILOT: 'border-blue-700 bg-blue-50 text-blue-900',
  PROVISIONAL: 'border-slate-500 bg-slate-50 text-slate-800',
  FLAGGED: 'border-red-700 bg-red-50 text-red-900',
  RETIRED: 'border-slate-400 bg-slate-100 text-slate-600',
  MISSING: 'border-amber-700 bg-amber-50 text-amber-900',
}

function CalibrationStatus({
  status,
  assignmentId,
  count,
  className,
}: {
  status: AdaptiveItemCalibrationStatus | ItemBankCalibrationStatus
  assignmentId?: number
  count?: number
  className?: string
}) {
  const t = useTranslations()

  return (
    <span
      data-cy={
        typeof assignmentId === 'number'
          ? `adaptive-calibration-status-${assignmentId}`
          : undefined
      }
    >
      <Badge
        className={twMerge(
          'rounded border font-medium hover:bg-inherit',
          STATUS_CLASSES[status],
          className
        )}
      >
        {t(`manage.competenceTree.calibration.status.${status}`)}
        {typeof count === 'number' ? `: ${count}` : ''}
      </Badge>
    </span>
  )
}

export default CalibrationStatus
