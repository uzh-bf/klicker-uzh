import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementBlockStatus } from '@klicker-uzh/graphql/dist/ops'
import { Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface BlockStatusIndicatorProps {
  status: ElementBlockStatus
  lastRefetchTime?: Date
  expiresAt?: string | null
  className?: string
}

function BlockStatusIndicator({
  status,
  lastRefetchTime,
  expiresAt,
  className,
}: BlockStatusIndicatorProps) {
  const t = useTranslations()

  const getTooltipContent = () => {
    switch (status) {
      case ElementBlockStatus.Scheduled:
        return (
          <div className="text-sm">
            <div className="font-semibold">
              {t('manage.evaluation.instanceScheduled')}
            </div>
          </div>
        )
      case ElementBlockStatus.Active:
        return (
          <div className="text-sm">
            <div className="font-semibold">
              {t('manage.evaluation.instanceActive')}
            </div>
            {lastRefetchTime && (
              <div className="mt-1 text-xs text-gray-600">
                {t('manage.evaluation.instanceLastRefetch')}:{' '}
                {lastRefetchTime.toLocaleString()}
              </div>
            )}
          </div>
        )
      case ElementBlockStatus.Executed:
        return (
          <div className="text-sm">
            <div className="font-semibold">
              {t('manage.evaluation.instanceExecuted')}
            </div>
            {expiresAt && (
              <div className="mt-1 text-xs text-gray-600">
                {t('manage.evaluation.instanceExecutionDate')}:{' '}
                {new Date(expiresAt).toLocaleString()}
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  }

  const getStatusDot = () => {
    switch (status) {
      case ElementBlockStatus.Scheduled:
        return <div className="h-4 w-4 rounded-full bg-gray-400 shadow-lg" />
      case ElementBlockStatus.Active:
        return (
          <div className="h-4 w-4 animate-pulse rounded-full bg-green-400 shadow-lg" />
        )
      case ElementBlockStatus.Executed:
        return (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 shadow-lg">
            <FontAwesomeIcon icon={faCheck} className="text-xs text-white" />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className={twMerge('flex justify-center', className)}>
      <Tooltip
        tooltip={getTooltipContent()}
        className={{
          tooltip:
            'max-w-xs rounded border border-gray-200 bg-white p-2 shadow-lg',
        }}
      >
        {getStatusDot()}
      </Tooltip>
    </div>
  )
}

export default BlockStatusIndicator
