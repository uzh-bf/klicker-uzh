import { useSubscription } from '@apollo/client'
import {
  GroupActivityEndedDocument,
  GroupActivityStartedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

interface GroupActivityListSubscriberProps {
  courseId: string
  onChanged?: () => void | Promise<void>
}

function GroupActivityListSubscriber({
  courseId,
  onChanged,
}: GroupActivityListSubscriberProps) {
  const t = useTranslations()
  const onChangedRef = useRef(onChanged)
  const handledEndedActivityIdsRef = useRef<Set<string>>(new Set())
  const handledStartedActivityIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

  const { data: endedData } = useSubscription(GroupActivityEndedDocument, {
    variables: { courseId },
  })
  const { data: startedData } = useSubscription(GroupActivityStartedDocument, {
    variables: { courseId },
  })

  useEffect(() => {
    const updatedActivity = endedData?.groupActivityEnded
    if (
      !updatedActivity ||
      handledEndedActivityIdsRef.current.has(updatedActivity.id)
    ) {
      return
    }

    handledEndedActivityIdsRef.current.add(updatedActivity.id)

    toast({
      type: 'warning',
      message: t('pwa.courses.groupActivityEndedToast', {
        activityName: updatedActivity.displayName,
      }),
      options: { duration: 10000 },
    })

    void onChangedRef.current?.()
  }, [endedData?.groupActivityEnded, t])

  useEffect(() => {
    const newActivity = startedData?.groupActivityStarted
    if (
      !newActivity ||
      handledStartedActivityIdsRef.current.has(newActivity.id)
    ) {
      return
    }

    handledStartedActivityIdsRef.current.add(newActivity.id)

    toast({
      type: 'success',
      message: t('pwa.courses.groupActivityStartedToast', {
        activityName: newActivity.displayName,
      }),
      options: { duration: 10000 },
    })

    void onChangedRef.current?.()
  }, [startedData?.groupActivityStarted, t])

  return null
}

export default GroupActivityListSubscriber
