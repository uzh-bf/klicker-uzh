import { SubscribeToMoreOptions } from '@apollo/client'
import {
  ElementBlock,
  LiveQuiz,
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
    subscribeToMore({
      document: RunningLiveQuizUpdatedDocument,
      variables: {
        quizId: id,
      },
      updateQuery: (
        prev: { studentLiveQuiz: LiveQuiz },
        {
          subscriptionData,
        }: {
          subscriptionData: { data: { runningLiveQuizUpdated: ElementBlock } }
        }
      ) => {
        if (!subscriptionData.data) return prev
        return Object.assign({}, prev, {
          studentLiveQuiz: {
            ...prev.studentLiveQuiz,
            activeBlock: subscriptionData.data.runningLiveQuizUpdated,
          },
        })
      },
    })
  }, [id, subscribeToMore])

  return <div />
}

export default LiveQuizSubscriber
