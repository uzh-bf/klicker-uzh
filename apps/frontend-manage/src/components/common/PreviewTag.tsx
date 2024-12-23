import { Badge } from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

function PreviewTag({ className }: { className?: string }) {
  const t = useTranslations()

  return (
    <Badge
      className={twMerge(
        'bg-green-700 text-white hover:bg-green-800',
        className
      )}
    >
      {t('shared.generic.featurePreview')}
    </Badge>
  )
}

export default PreviewTag
