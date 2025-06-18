import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ConfettiExplosion from 'react-confetti-explosion'

function AllQuestionsAnsweredMessage({
  gamificationEnabled,
}: {
  gamificationEnabled: boolean
}) {
  const t = useTranslations()
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (gamificationEnabled) {
      setShowConfetti(true)
    }
  }, [gamificationEnabled])

  return (
    <div className="relative">
      <UserNotification
        type="success"
        className={{ root: 'mt-4 text-base md:mt-1' }}
        message={t('pwa.liveQuiz.allQuestionsAnswered')}
      />
      {showConfetti && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
          <ConfettiExplosion duration={2000} />
        </div>
      )}
    </div>
  )
}

export default AllQuestionsAnsweredMessage
