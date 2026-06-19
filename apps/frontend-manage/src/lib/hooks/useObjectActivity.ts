import type { ObjectType } from '@lib/constants/sharingEnums'
import { trpc, type RouterInputs, type RouterOutputs } from '../trpc'

type ObjectActivityInput = RouterInputs['sharing']['objectActivity']

export type ActivityLogEntry = NonNullable<
  RouterOutputs['sharing']['objectActivity']['objectActivity']
>[number]

export function useObjectActivity({
  objectId,
  objectType,
  visible = true,
}: {
  objectId: string | number
  objectType: ObjectType
  visible?: boolean
}) {
  const utils = trpc.useUtils()
  const activityInput: ObjectActivityInput = {
    objectId: String(objectId),
    objectType: objectType as unknown as ObjectActivityInput['objectType'],
  }

  const { data, isLoading, isFetching, error, refetch } =
    trpc.sharing.objectActivity.useQuery(activityInput, {
      enabled: Boolean(objectId) && visible,
      refetchOnMount: 'always',
    })

  const addMessage = trpc.sharing.addActivityMessage.useMutation({
    onSuccess: (mutationData) => {
      if (!mutationData.activityMessage) return

      utils.sharing.objectActivity.setData(activityInput, (queryData) => {
        if (!queryData?.objectActivity) return queryData

        return {
          objectActivity: [
            ...queryData.objectActivity,
            mutationData.activityMessage!,
          ],
        }
      })
    },
  })

  const resolveMessage = trpc.sharing.resolveActivityLogEntry.useMutation()

  const deleteMessage = trpc.sharing.deleteActivityMessage.useMutation({
    onSuccess: (mutationData, variables) => {
      if (!mutationData.deleted) return

      utils.sharing.objectActivity.setData(activityInput, (queryData) => {
        if (!queryData?.objectActivity) return queryData

        return {
          objectActivity: queryData.objectActivity.filter(
            (entry) => entry.id !== variables.id
          ),
        }
      })
    },
  })

  const addActivityMessage = async (message: string) => {
    if (!objectId) {
      console.error(
        '[useObjectActivity] Cannot add message - objectId is undefined'
      )
      return
    }

    return addMessage.mutateAsync({
      ...activityInput,
      message,
    })
  }

  const resolveActivityLogEntry = async (id: number, _resolved: boolean) => {
    return resolveMessage.mutateAsync({ id })
  }

  const deleteActivityMessage = async (id: number) => {
    return deleteMessage.mutateAsync({ id })
  }

  const entries: ActivityLogEntry[] = data?.objectActivity || []

  return {
    entries,
    loading: isLoading || (isFetching && !data),
    error,
    addActivityMessage,
    resolveActivityLogEntry,
    deleteActivityMessage,
    isAddingMessage: addMessage.isLoading,
    isResolvingMessage: resolveMessage.isLoading,
    isDeletingMessage: deleteMessage.isLoading,
    refetch,
  }
}
