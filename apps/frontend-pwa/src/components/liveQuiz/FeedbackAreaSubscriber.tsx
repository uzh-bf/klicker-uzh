import { api } from '@lib/trpc'
import { useEffect, useRef } from 'react'

function FeedbackAreaSubscriber({
  quizId,
  onChanged,
}: {
  quizId: string
  onChanged: () => unknown | Promise<unknown>
}) {
  const onChangedRef = useRef(onChanged)

  useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

  api.realtime.feedbackAdded.useSubscription(
    { quizId },
    {
      enabled: Boolean(quizId),
      onData() {
        void Promise.resolve(onChangedRef.current()).catch(console.error)
      },
    }
  )

  api.realtime.feedbackRemoved.useSubscription(
    { quizId },
    {
      enabled: Boolean(quizId),
      onData() {
        void Promise.resolve(onChangedRef.current()).catch(console.error)
      },
    }
  )

  api.realtime.feedbackUpdated.useSubscription(
    { quizId },
    {
      enabled: Boolean(quizId),
      onData() {
        void Promise.resolve(onChangedRef.current()).catch(console.error)
      },
    }
  )

  return null
}

export default FeedbackAreaSubscriber
