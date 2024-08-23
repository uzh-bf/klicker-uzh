import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { MicroLearning } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface MicroLearningPreviewLinkProps {
  microLearning: Partial<MicroLearning> & Pick<MicroLearning, 'name'>
  href: string
}

function MicroLearningPreviewLink({
  microLearning,
  href,
}: MicroLearningPreviewLinkProps) {
  const t = useTranslations()

  return (
    <Link
      href={href}
      target="_blank"
      className="text-primary-100 flex flex-row items-center gap-1"
      data-cy={`open-microlearning-${microLearning.name}`}
    >
      <FontAwesomeIcon icon={faExternalLink} size="sm" className="w-4" />
      <div>{t('shared.generic.open')}</div>
    </Link>
  )
}

export default MicroLearningPreviewLink
