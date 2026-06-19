import { api } from '@lib/trpc'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

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

  api.realtime.singleGroupActivityEnded.useSubscription(
    { activityId },
    {
      onData() {
        setActivityEnded(true)
        toast({
          type: 'warning',
          message: t('pwa.groupActivity.groupActivityEnded', {
            activityName: groupActivityName,
          }),
          options: { duration: 10000 },
        })

        void onEnded()
      },
    }
  )

  return null
}

export default GroupActivitySubscriber
