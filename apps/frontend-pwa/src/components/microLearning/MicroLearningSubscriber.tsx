import { useSubscription } from '@apollo/client'
import {
  MicroLearningEndedDocument,
  type MicroLearningEndedSubscription,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

type EndedMicroLearning = MicroLearningEndedSubscription['microLearningEnded']

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

  const { data } = useSubscription(MicroLearningEndedDocument, {
    variables: { activityId },
  })

  useEffect(() => {
    const microLearning = data?.microLearningEnded
    if (!microLearning || handledActivityIdRef.current === microLearning.id) {
      return
    }

    handledActivityIdRef.current = microLearning.id

    toast({
      type: 'warning',
      message: t('pwa.courses.microLearningEndedToast', {
        activityName: microLearningName,
      }),
      options: { duration: 10000 },
    })

    void onEndedRef.current?.(microLearning)
  }, [data?.microLearningEnded, microLearningName, t])

  return null
}

export default MicroLearningSubscriber
