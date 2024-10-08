import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface MicroLearningEvaluationLinkProps {
  quizName: string
  evaluationHref: string
}

function MicroLearningEvaluationLink({
  quizName,
  evaluationHref,
}: MicroLearningEvaluationLinkProps) {
  const t = useTranslations()

  return (
    <Link
      href={evaluationHref}
      target="_blank"
      className="text-primary-100 flex flex-row items-center gap-1"
      data-cy={`evaluation-microlearning-${quizName}`}
    >
      <FontAwesomeIcon icon={faExternalLink} size="sm" className="w-4" />
      <div>{t('manage.courseList.openEvaluation')}</div>
    </Link>
  )
}

export default MicroLearningEvaluationLink
