import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
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
    <Link href={href} target="_blank">
      <Button
        basic
        className={{
          root: 'flex flex-row items-center gap-1 text-primary',
        }}
        data={{ cy: `open-practice-quiz-${practiceQuiz.name}` }}
      >
        <FontAwesomeIcon icon={faExternalLink} size="sm" className="w-4" />
        <div>{t('shared.generic.open')}</div>
      </Button>
    </Link>
  )
}

export default PracticeQuizPreviewLink
