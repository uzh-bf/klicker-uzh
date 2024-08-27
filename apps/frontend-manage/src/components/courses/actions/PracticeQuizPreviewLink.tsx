import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface PracticeQuizPreviewLinkProps {
  practiceQuiz: Partial<PracticeQuiz>
  href: string
}

function PracticeQuizPreviewLink({
  practiceQuiz,
  href,
}: PracticeQuizPreviewLinkProps) {
  const t = useTranslations()

  return (
    <Link
      href={href}
      target="_blank"
      className="text-primary-100 flex flex-row items-center gap-1"
      data-cy={`open-practice-quiz-${practiceQuiz.name}`}
    >
      <FontAwesomeIcon icon={faExternalLink} size="sm" className="w-4" />
      <div>{t('shared.generic.open')}</div>
    </Link>
  )
}

export default PracticeQuizPreviewLink
