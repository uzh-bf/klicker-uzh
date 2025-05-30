import { faLink } from '@fortawesome/free-solid-svg-icons'
import { MicroLearning } from '@klicker-uzh/graphql/dist/ops'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface MicroLearningAccessLinkProps {
  microLearning: Partial<MicroLearning> & Pick<MicroLearning, 'name'>
  href: string
}

function MicroLearningAccessLink({
  microLearning,
  href,
}: MicroLearningAccessLinkProps) {
  const t = useTranslations()

  return (
    <Button
      basic
      onClick={() => {
        try {
          navigator.clipboard.writeText(href)
          toast({
            type: 'success',
            message: t('manage.course.linkAccessCopied'),
            options: { duration: 4000 },
          })
        } catch (e) {}
      }}
      className={{
        root: 'text-primary-100 hover:text-primary-100 h-7 py-0 text-sm',
      }}
      data={{ cy: `copy-quiz-link-${microLearning.name}` }}
    >
      <Button.Icon icon={faLink} />
      <Button.Label>{t('manage.course.copyAccessLink')}</Button.Label>
    </Button>
  )
}

export default MicroLearningAccessLink
