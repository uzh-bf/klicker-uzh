import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

export default function AdaptiveActivitySummary({
  treeName,
  elementCount,
  published,
}: {
  treeName?: string | null
  elementCount?: number | null
  published: boolean
}) {
  const t = useTranslations('manage.adaptiveActivitySummary')
  return (
    <UserNotification
      type="info"
      className={{ root: 'w-full', content: 'w-full' }}
    >
      <div
        data-cy="adaptive-activity-summary"
        className="flex flex-col gap-1 text-sm"
      >
        <span className="font-bold">{t('title')}</span>
        <div>
          <span className="font-semibold">{t('tree')}:</span>{' '}
          {treeName ?? t('notAssigned')}
        </div>
        {elementCount != null && (
          <div>
            {t(published ? 'poolCount' : 'treeCount', { count: elementCount })}
          </div>
        )}
      </div>
    </UserNotification>
  )
}
