import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

// load confetti explosion dynamically to avoid SSR issues
const ConfettiExplosion = dynamic(() => import('react-confetti-explosion'), {
  ssr: false,
})

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
        className={{ root: 'mt-1.5 md:text-base' }}
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
