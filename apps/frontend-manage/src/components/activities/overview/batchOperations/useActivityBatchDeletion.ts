import { useMutation } from '@apollo/client'
import {
  type ActivityInfo,
  ActivityType,
  DeleteGroupActivityDocument,
  DeleteLiveQuizDocument,
  DeleteMicroLearningDocument,
  DeletePracticeQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'

const DELETE_CONCURRENCY = 5

export type ActivityBatchDeletionOutcome = {
  activity: ActivityInfo
  status: 'deleted' | 'failed' | 'uncertain'
}

function useActivityBatchDeletion() {
  const [deleteLiveQuiz] = useMutation(DeleteLiveQuizDocument)
  const [deletePracticeQuiz] = useMutation(DeletePracticeQuizDocument)
  const [deleteMicroLearning] = useMutation(DeleteMicroLearningDocument)
  const [deleteGroupActivity] = useMutation(DeleteGroupActivityDocument)

  async function deleteActivity(activity: ActivityInfo) {
    if (activity.type === ActivityType.LiveQuiz) {
      const { data } = await deleteLiveQuiz({
        variables: { id: activity.id },
      })
      return data?.deleteLiveQuiz?.id === activity.id
    }

    if (activity.type === ActivityType.PracticeQuiz) {
      const { data } = await deletePracticeQuiz({
        variables: { id: activity.id },
      })
      return data?.deletePracticeQuiz?.id === activity.id
    }

    if (activity.type === ActivityType.MicroLearning) {
      const { data } = await deleteMicroLearning({
        variables: { id: activity.id },
      })
      return data?.deleteMicroLearning?.id === activity.id
    }

    if (activity.type === ActivityType.GroupActivity) {
      const { data } = await deleteGroupActivity({
        variables: { id: activity.id },
      })
      return data?.deleteGroupActivity?.id === activity.id
    }

    return false
  }

  return async function deleteActivitiesBatch(
    activities: ActivityInfo[]
  ): Promise<ActivityBatchDeletionOutcome[]> {
    const outcomes: ActivityBatchDeletionOutcome[] = []

    for (
      let index = 0;
      index < activities.length;
      index += DELETE_CONCURRENCY
    ) {
      const chunk = activities.slice(index, index + DELETE_CONCURRENCY)
      const chunkOutcomes = await Promise.all(
        chunk.map(async (activity) => {
          try {
            const deleted = await deleteActivity(activity)
            return {
              activity,
              status: deleted ? ('deleted' as const) : ('failed' as const),
            }
          } catch (error) {
            console.error(error)
            return {
              activity,
              status: 'uncertain' as const,
            }
          }
        })
      )
      outcomes.push(...chunkOutcomes)
    }

    return outcomes
  }
}

export default useActivityBatchDeletion
