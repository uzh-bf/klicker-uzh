import { Markdown } from '@klicker-uzh/markdown'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

function EvaluationExplanation({
  explanation,
  showExplanation,
  textSize,
  textSizeLg,
}: {
  explanation?: string | null
  showExplanation: boolean
  textSize: string
  textSizeLg: string
}) {
  const t = useTranslations()

  return explanation && showExplanation ? (
    <UserNotification type="success" className={{ root: 'my-2 items-center' }}>
      <div className={twMerge('font-bold', textSizeLg)}>
        {t('shared.generic.explanation')}
      </div>
      <Markdown content={explanation} className={{ root: textSize }} />
    </UserNotification>
  ) : null
}

export default EvaluationExplanation
