import { faHandPointer } from '@fortawesome/free-regular-svg-icons'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ActivityActionsTrigger() {
  const t = useTranslations()

  return (
    <Button className={{ root: 'h-7 text-sm' }}>
      <Button.Icon icon={faHandPointer} />
      <Button.Label>{t('manage.course.otherActions')}</Button.Label>
    </Button>
  )
}

export default ActivityActionsTrigger
