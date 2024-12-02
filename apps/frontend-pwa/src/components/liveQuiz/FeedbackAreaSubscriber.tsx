import { SubscribeToMoreOptions } from '@apollo/client'
import {
  Feedback,
  FeedbackAddedDocument,
  FeedbackRemovedDocument,
  FeedbackUpdatedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useEffect } from 'react'

function FeedbackAreaSubscriber({
  subscribeToMore,
  quizId,
}: {
  quizId: string
  subscribeToMore: (doc: SubscribeToMoreOptions) => any
}) {
  useEffect(() => {
    if (!quizId) return

    const feedbackAdded = subscribeToMore({
      document: FeedbackAddedDocument,
      variables: { quizId },
      updateQuery: (
        prev: { feedbacks: Feedback[] },
        {
          subscriptionData,
        }: { subscriptionData: { data: { feedbackAdded: Feedback } } }
      ) => {
        if (!subscriptionData.data) return prev
        const newItem = subscriptionData.data.feedbackAdded
        if (prev.feedbacks?.map((item) => item.id).includes(newItem.id))
          return prev
        return { ...prev, feedbacks: [newItem, ...prev.feedbacks] }
      },
    })

    const feedbackRemoved = subscribeToMore({
      document: FeedbackRemovedDocument,
      variables: { quizId },
      updateQuery: (
        prev: { feedbacks: Feedback[] },
        {
          subscriptionData,
        }: { subscriptionData: { data: { feedbackRemoved: string } } }
      ) => {
        if (!subscriptionData.data) return prev
        const removedItem = subscriptionData.data.feedbackRemoved
        return {
          ...prev,
          feedbacks: prev.feedbacks?.filter(
            (item) => item.id !== parseInt(removedItem)
          ),
        }
      },
    })

    const feedbackUpdated = subscribeToMore({
      document: FeedbackUpdatedDocument,
      variables: { quizId },
      updateQuery: (
        prev: { feedbacks: Feedback[] },
        {
          subscriptionData,
        }: { subscriptionData: { data: { feedbackUpdated: Feedback } } }
      ) => {
        if (!subscriptionData.data) return prev
        const updatedItem = subscriptionData.data.feedbackUpdated
        return {
          ...prev,
          feedbacks: prev.feedbacks?.map((item) => {
            if (item.id === updatedItem.id) return updatedItem
            return item
          }),
        }
      },
    })

    return () => {
      feedbackAdded && feedbackAdded()
      feedbackRemoved && feedbackRemoved()
      feedbackUpdated && feedbackUpdated()
    }
  }, [subscribeToMore, quizId])

  return <div></div>
}

export default FeedbackAreaSubscriber
