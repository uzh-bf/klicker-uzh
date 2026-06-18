import { faQrcode } from '@fortawesome/free-solid-svg-icons'
import { LocaleType } from '@lib/evaluationTypes'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import LiveQuizQRModal from '../../liveQuiz/cockpit/LiveQuizQRModal'

function LiveQuizEvaluationQRCode({
  language,
  isAssessmentEnabled,
  pinCode,
  className,
}: {
  language?: LocaleType | null
  isAssessmentEnabled: boolean
  pinCode?: string | null
  className?: string
}) {
  const router = useRouter()
  const t = useTranslations()
  const [showQrCodes, setShowQrCodes] = useState(false)

  return (
    <div
      className={twMerge(
        'group relative float-end hidden h-max w-full items-center justify-center lg:flex',
        className
      )}
    >
      <Button
        onClick={() => setShowQrCodes(true)}
        className={{ root: 'w-full' }}
      >
        <Button.Icon icon={faQrcode} />
        <Button.Label>{t('manage.evaluation.showQRCodes')}</Button.Label>
      </Button>
      {showQrCodes && (
        <LiveQuizQRModal
          quizId={router.query.id as string}
          quizPin={pinCode}
          isAssessmentEnabled={isAssessmentEnabled}
          language={language as never}
          onClose={() => setShowQrCodes(false)}
        />
      )}
    </div>
  )
}

export default LiveQuizEvaluationQRCode
