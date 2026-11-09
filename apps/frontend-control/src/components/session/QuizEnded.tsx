import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { largeButtonClass, primaryButtonClass } from '../common/styles'

interface QuizEndedProps {
  name: string
  numOfBlocks: number
  backHref: string
}

function QuizEnded({ name, numOfBlocks, backHref }: QuizEndedProps) {
  const t = useTranslations()
  const router = useRouter()

  return (
    <div
      className="mx-auto max-w-[480px] pt-12 text-center"
      data-cy="live-quiz-ended"
    >
      <span className="bg-ctrl-good-bg inline-flex h-12 w-12 items-center justify-center rounded-md">
        <FontAwesomeIcon icon={faCheck} className="text-ctrl-good h-6 w-6" />
      </span>
      <h1 className="text-ctrl-ink mt-4 text-2xl font-bold">
        {t('control.liveQuiz.ended')}
      </h1>
      <div className="text-ctrl-muted mt-1.5 text-[15px]">
        {t('control.liveQuiz.endedSummary', { name, blocks: numOfBlocks })}
      </div>
      <Button
        onClick={() => router.push(backHref)}
        className={{ root: `${largeButtonClass} ${primaryButtonClass} mt-6` }}
        data={{ cy: 'back-to-course' }}
      >
        {t('control.liveQuiz.backToCourse')}
      </Button>
    </div>
  )
}

export default QuizEnded
