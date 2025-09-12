import { SubscribeToMoreOptions } from '@apollo/client'
import {
  LiveQuiz,
  LiveQuizSettingsChangedDocument,
  LiveQuizStudentSettings,
  RunningLiveQuizUpdatedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useEffect } from 'react'

function LiveQuizSubscriber({
  id,
  subscribeToMore,
}: {
  id: string
  subscribeToMore: (doc: SubscribeToMoreOptions) => any
}) {
  useEffect(() => {
    // update the active block on the student view through a subscription on block start / end
    const activeBlockChanged = subscribeToMore({
      document: RunningLiveQuizUpdatedDocument,
      variables: { id },
      updateQuery: (
        prev: { studentLiveQuiz: LiveQuiz },
        {
          subscriptionData,
        }: {
          subscriptionData: { data: { runningLiveQuizUpdated: LiveQuiz } }
        }
      ) => {
        if (!subscriptionData.data) return prev
        return Object.assign({}, prev, {
          studentLiveQuiz: {
            ...prev.studentLiveQuiz,
            ...subscriptionData.data.runningLiveQuizUpdated,
          },
        })
      },
    })

    // live quiz student settings changed (Q&A channel or confusion feedback enabled / disabled)
    const liveQuizSettingsChanged = subscribeToMore({
      document: LiveQuizSettingsChangedDocument,
      variables: { quizId: id },
      updateQuery: (
        prev: { studentLiveQuiz: LiveQuiz },
        {
          subscriptionData,
        }: {
          subscriptionData: {
            data: { liveQuizSettingsChanged: LiveQuizStudentSettings }
          }
        }
      ) => {
        if (!subscriptionData.data) return prev
        return Object.assign({}, prev, {
          studentLiveQuiz: {
            ...prev.studentLiveQuiz,
            isLiveQAEnabled:
              subscriptionData.data.liveQuizSettingsChanged.isLiveQAEnabled,
            isConfusionFeedbackEnabled:
              subscriptionData.data.liveQuizSettingsChanged
                .isConfusionFeedbackEnabled,
          },
        })
      },
    })

    return () => {
      activeBlockChanged && activeBlockChanged()
      liveQuizSettingsChanged && liveQuizSettingsChanged()
    }
  }, [id, subscribeToMore])

  return <div />
}

export default LiveQuizSubscriber
