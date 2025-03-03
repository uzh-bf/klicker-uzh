import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'
import PrimaryActionLink from './PrimaryActionLink'

interface MicroLearningEvaluationPrimaryLinkProps {
  quizName: string
  evaluationHref: string
}

function MicroLearningEvaluationPrimaryLink({
  quizName,
  evaluationHref,
}: MicroLearningEvaluationPrimaryLinkProps) {
  const t = useTranslations()

  return (
    <PrimaryActionLink
      href={evaluationHref}
      target="_blank"
      rel="noopener noreferrer"
      label={t('manage.courseList.openEvaluation')}
      icon={faExternalLink}
      data={{ cy: `evaluation-microlearning-${quizName}` }}
    />
  )
}

export default MicroLearningEvaluationPrimaryLink
