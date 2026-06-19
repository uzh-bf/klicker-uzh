import type { MicroLearningEndedEvent } from '@klicker-uzh/api'
import { api } from '@lib/trpc'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

type EndedMicroLearning = MicroLearningEndedEvent

interface MicroLearningSubscriberProps {
  activityId: string
  microLearningName: string
  onEnded?: (microLearning: EndedMicroLearning) => void | Promise<void>
}

function MicroLearningSubscriber({
  activityId,
  microLearningName,
  onEnded,
}: MicroLearningSubscriberProps) {
  const t = useTranslations()
  const onEndedRef = useRef(onEnded)
  const handledActivityIdRef = useRef<string | null>(null)

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  api.realtime.microLearningEnded.useSubscription(
    { activityId },
    {
      onData(microLearning) {
        if (handledActivityIdRef.current === microLearning.id) return

        handledActivityIdRef.current = microLearning.id

        toast({
          type: 'warning',
          message: t('pwa.courses.microLearningEndedToast', {
            activityName: microLearningName,
          }),
          options: { duration: 10000 },
        })

        void onEndedRef.current?.(microLearning)
      },
    }
  )

  return null
}

export default MicroLearningSubscriber
