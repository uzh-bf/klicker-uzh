import { faLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Badge } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

// marks a live quiz that collects correlated responses, so its answers can be
// attributed to a single pseudonymous respondent across questions instead of
// being counted only in aggregate
function AttributableBadge({ className }: { className?: string }) {
  const t = useTranslations()

  return (
    <Badge
      className={twMerge('gap-2 bg-sky-700 hover:bg-sky-800', className)}
      data-cy="attributable-badge"
    >
      <FontAwesomeIcon icon={faLink} />
      {t('shared.generic.attributable')}
    </Badge>
  )
}

export default AttributableBadge
