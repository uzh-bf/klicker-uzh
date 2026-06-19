import { api } from '@lib/trpc'
import { useEffect, useRef } from 'react'

function LiveQuizSubscriber({
  id,
  onChanged,
}: {
  id: string
  onChanged: () => unknown | Promise<unknown>
}) {
  const onChangedRef = useRef(onChanged)

  useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

  api.realtime.runningLiveQuizUpdated.useSubscription(
    { id },
    {
      onData() {
        void onChangedRef.current()
      },
    }
  )

  api.realtime.liveQuizSettingsChanged.useSubscription(
    { quizId: id },
    {
      onData() {
        void onChangedRef.current()
      },
    }
  )

  return null
}

export default LiveQuizSubscriber
