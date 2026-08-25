import { useMutation } from '@apollo/client'
import {
  type ActivityInfo,
  ActivityType,
  DeleteGroupActivityBatchDocument,
  DeleteLiveQuizDocument,
  DeleteMicroLearningBatchDocument,
  DeletePracticeQuizBatchDocument,
} from '@klicker-uzh/graphql/dist/ops'

const DELETE_CONCURRENCY = 5

export type ActivityBatchDeletionOutcome = {
  activity: ActivityInfo
  status: 'deleted' | 'failed' | 'uncertain'
  failureReason?: 'request-failed'
}

export type ActivityBatchDeletionProgress = {
  completed: number
  total: number
}

function assertNever(value: never): never {
  throw new Error(`Unsupported activity type: ${String(value)}`)
}

function throwOnMutationErrors(
  errors: readonly { message: string }[] | undefined
) {
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join('; '))
  }
}

type DeleteMutationResult<TData> = {
  data?: TData | null
  errors?: readonly { message: string }[]
}

async function deleteActivityWithMutation<TData extends object>(
  activity: ActivityInfo,
  mutate: (options: {
    variables: { id: string }
  }) => Promise<DeleteMutationResult<TData>>,
  field: keyof TData
) {
  const { data, errors } = await mutate({
    variables: { id: activity.id },
  })
  throwOnMutationErrors(errors)
  const deletedActivity = data?.[field] as
    | { id?: string | null }
    | null
    | undefined
  return deletedActivity?.id === activity.id
}

function useActivityBatchDeletion() {
  const [deleteLiveQuiz] = useMutation(DeleteLiveQuizDocument)
  const [deletePracticeQuiz] = useMutation(DeletePracticeQuizBatchDocument)
  const [deleteMicroLearning] = useMutation(DeleteMicroLearningBatchDocument)
  const [deleteGroupActivity] = useMutation(DeleteGroupActivityBatchDocument)

  async function deleteActivity(activity: ActivityInfo) {
    switch (activity.type) {
      case ActivityType.LiveQuiz:
        return deleteActivityWithMutation(
          activity,
          deleteLiveQuiz,
          'deleteLiveQuiz'
        )
      case ActivityType.PracticeQuiz:
        return deleteActivityWithMutation(
          activity,
          deletePracticeQuiz,
          'deletePracticeQuiz'
        )
      case ActivityType.MicroLearning:
        return deleteActivityWithMutation(
          activity,
          deleteMicroLearning,
          'deleteMicroLearning'
        )
      case ActivityType.GroupActivity:
        return deleteActivityWithMutation(
          activity,
          deleteGroupActivity,
          'deleteGroupActivity'
        )
      default:
        return assertNever(activity.type)
    }
  }

  async function deleteActivityWithOutcome(
    activity: ActivityInfo
  ): Promise<ActivityBatchDeletionOutcome> {
    try {
      const deleted = await deleteActivity(activity)
      return {
        activity,
        status: deleted ? 'deleted' : 'failed',
      }
    } catch (error) {
      console.error('Batch activity deletion failed', {
        activityId: activity.id,
        activityType: activity.type,
        error,
      })
      return {
        activity,
        status: 'uncertain',
        failureReason: 'request-failed',
      }
    }
  }

  return async function deleteActivitiesBatch(
    activities: ActivityInfo[],
    onProgress?: (progress: ActivityBatchDeletionProgress) => void
  ): Promise<ActivityBatchDeletionOutcome[]> {
    const outcomes: ActivityBatchDeletionOutcome[] = []
    onProgress?.({ completed: 0, total: activities.length })

    let nextIndex = 0
    let completed = 0

    async function processNext(): Promise<void> {
      while (nextIndex < activities.length) {
        const index = nextIndex
        const activity = activities[index]
        nextIndex += 1

        if (!activity) continue

        outcomes[index] = await deleteActivityWithOutcome(activity)
        completed += 1
        onProgress?.({ completed, total: activities.length })
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(DELETE_CONCURRENCY, activities.length) },
        () => processNext()
      )
    )

    return outcomes
  }
}

export default useActivityBatchDeletion
