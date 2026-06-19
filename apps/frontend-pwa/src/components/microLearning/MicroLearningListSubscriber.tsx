import { api } from '@lib/trpc'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

function MicroLearningListSubscriber({
  activityId,
  onEnded,
}: {
  activityId: string
  onEnded?: () => void | Promise<void>
}) {
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
          type: 'success',
          message: t('pwa.courses.microLearningEndedToast', {
            activityName: microLearning.displayName,
          }),
          options: { duration: 10000 },
        })

        void onEndedRef.current?.()
      },
    }
  )

  return null
}

export default MicroLearningListSubscriber
