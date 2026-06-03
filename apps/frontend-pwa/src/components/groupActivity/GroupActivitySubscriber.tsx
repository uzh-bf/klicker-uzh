import { useSubscription } from '@apollo/client'
import { SingleGroupActivityEndedDocument } from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useEffect } from 'react'

interface GroupActivitySubscriberProps {
  activityId: string
  groupActivityName: string
  onEnded: () => Promise<unknown> | unknown
  setActivityEnded: Dispatch<SetStateAction<boolean>>
}

function GroupActivitySubscriber({
  activityId,
  groupActivityName,
  onEnded,
  setActivityEnded,
}: GroupActivitySubscriberProps) {
  const t = useTranslations()
  const { data } = useSubscription(SingleGroupActivityEndedDocument, {
    variables: { activityId },
  })

  useEffect(() => {
    if (!data?.singleGroupActivityEnded) return

    setActivityEnded(true)
    toast({
      type: 'warning',
      message: t('pwa.groupActivity.groupActivityEnded', {
        activityName: groupActivityName,
      }),
      options: { duration: 10000 },
    })

    void onEnded()
  }, [
    data?.singleGroupActivityEnded,
    groupActivityName,
    onEnded,
    setActivityEnded,
    t,
  ])

  return null
}

export default GroupActivitySubscriber
