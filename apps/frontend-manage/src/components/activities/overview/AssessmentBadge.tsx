import { faShieldHalved } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Badge } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

function AssessmentBadge({ className }: { className?: string }) {
  const t = useTranslations()

  return (
    <Badge
      className={twMerge('gap-2 bg-orange-600 hover:bg-orange-700', className)}
    >
      <FontAwesomeIcon icon={faShieldHalved} />
      {t('shared.generic.assessment')}
    </Badge>
  )
}

export default AssessmentBadge
