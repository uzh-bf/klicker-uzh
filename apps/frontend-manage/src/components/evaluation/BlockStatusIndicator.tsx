import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementBlockStatus } from '@klicker-uzh/graphql/dist/ops'
import { Tooltip } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface BlockStatusIndicatorProps {
  status: ElementBlockStatus
  lastRefetchTime?: Date
  closedAt?: string | null
  className?: string
}

function BlockStatusIndicator({
  status,
  lastRefetchTime,
  closedAt,
  className,
}: BlockStatusIndicatorProps) {
  const t = useTranslations()
  const formatter = useFormatter()
  const closedAtDate = closedAt ? new Date(closedAt) : null
  const hasValidClosedAt =
    closedAtDate !== null && !Number.isNaN(closedAtDate.getTime())

  const getStatusPresentation = () => {
    switch (status) {
      case ElementBlockStatus.Scheduled:
        return {
          dot: <div className="h-4 w-4 rounded-full bg-gray-400 shadow-lg" />,
          tooltip: (
            <div className="text-sm">
              <div className="font-semibold">
                {t('manage.evaluation.instanceScheduled')}
              </div>
            </div>
          ),
        }
      case ElementBlockStatus.Active:
        return {
          dot: (
            <div className="h-4 w-4 animate-pulse rounded-full bg-green-400 shadow-lg" />
          ),
          tooltip: (
            <div className="text-sm">
              <div className="font-semibold">
                {t('manage.evaluation.instanceActive')}
              </div>
              {lastRefetchTime && (
                <div className="mt-1 text-xs text-gray-600">
                  {t('manage.evaluation.instanceLastRefetch')}:{' '}
                  {formatter.dateTime(lastRefetchTime, {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </div>
              )}
            </div>
          ),
        }
      case ElementBlockStatus.Executed:
        return {
          dot: (
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 shadow-lg">
              <FontAwesomeIcon icon={faCheck} className="text-xs text-white" />
            </div>
          ),
          tooltip: (
            <div className="text-sm">
              <div className="font-semibold">
                {t('manage.evaluation.instanceExecuted')}
              </div>
              {hasValidClosedAt && closedAtDate && (
                <div className="mt-1 text-xs text-gray-600">
                  {t('manage.evaluation.instanceExecutionDate')}:{' '}
                  {formatter.dateTime(closedAtDate, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
              )}
            </div>
          ),
        }
      default:
        return { dot: null, tooltip: null }
    }
  }

  const { dot, tooltip } = getStatusPresentation()

  return (
    <div className={twMerge('flex justify-center', className)}>
      <Tooltip
        tooltip={tooltip}
        className={{
          tooltip:
            'max-w-xs rounded border border-gray-200 bg-white p-2 shadow-lg',
        }}
      >
        {dot}
      </Tooltip>
    </div>
  )
}

export default BlockStatusIndicator
