import { useMutation, useQuery } from '@apollo/client'
import {
  ActivityLogEntry,
  AddActivityMessageDocument,
  DeleteActivityMessageDocument,
  GetObjectActivityDocument,
  ObjectType,
  ResolveActivityLogEntryDocument,
} from '@klicker-uzh/graphql/dist/ops'

export function useObjectActivity({
  objectId,
  objectType,
  visible = true,
}: {
  objectId: string | number
  objectType: ObjectType
  visible?: boolean
}) {
  // query for fetching activity entries using the unified query
  const { data, loading, error, refetch } = useQuery(
    GetObjectActivityDocument,
    {
      variables: { objectId: String(objectId), objectType },
      skip: !objectId || !visible,
      fetchPolicy: 'cache-and-network',
    }
  )

  // mutation for adding messages
  const [addMessage, { loading: addingMessage }] = useMutation(
    AddActivityMessageDocument
  )

  // mutation for resolving/unresolving messages
  const [resolveMessage, { loading: resolvingMessage }] = useMutation(
    ResolveActivityLogEntryDocument
  )

  // mutation for deleting messages
  const [deleteMessage, { loading: deletingMessage }] = useMutation(
    DeleteActivityMessageDocument
  )

  const addActivityMessage = async (message: string) => {
    if (!objectId) {
      console.error(
        '[useObjectActivity] Cannot add message - objectId is undefined'
      )
      return
    }

    return addMessage({
      variables: {
        objectId: typeof objectId === 'number' ? objectId.toString() : objectId,
        objectType,
        message,
      },
      update: (cache, { data }) => {
        // verify that the posting of the message was successful
        if (!data?.addActivityMessage) return

        // update the displayed messages
        cache.updateQuery(
          {
            query: GetObjectActivityDocument,
            variables: { objectId: String(objectId), objectType },
          },
          (qData) => {
            if (!qData?.getObjectActivity) return qData

            return {
              getObjectActivity: [
                ...(qData.getObjectActivity || []),
                data.addActivityMessage!,
              ],
            }
          }
        )
      },
    })
  }

  const resolveActivityLogEntry = async (id: number, resolved: boolean) => {
    return resolveMessage({
      variables: { id },
      optimisticResponse: {
        resolveActivityLogEntry: {
          __typename: 'ActivityLogEntry',
          id,
          resolved,
          // Set resolvedAt to current date if resolving, null if unresolving
          resolvedAt: resolved ? new Date().toISOString() : null,
        },
      },
      update: (cache, { data }) => {
        // verify that the resolution was successful
        if (!data?.resolveActivityLogEntry) return

        // update the displayed messages
        cache.updateQuery(
          {
            query: GetObjectActivityDocument,
            variables: { objectId: String(objectId), objectType },
          },
          (qData) => {
            if (!qData?.getObjectActivity) return qData

            return {
              getObjectActivity: qData.getObjectActivity.map((entry) =>
                entry.id === id
                  ? {
                      ...entry,
                      resolved: data.resolveActivityLogEntry!.resolved,
                      resolvedAt: data.resolveActivityLogEntry!.resolvedAt,
                    }
                  : entry
              ),
            }
          }
        )
      },
    })
  }

  const deleteActivityMessage = async (id: number) => {
    return deleteMessage({
      variables: { id },
      update: (cache, { data }) => {
        // verify that the deletion was successful
        if (!data?.deleteActivityMessage) return

        // update the displayed messages
        cache.updateQuery(
          {
            query: GetObjectActivityDocument,
            variables: { objectId: String(objectId), objectType },
          },
          (qData) => {
            if (!qData?.getObjectActivity) return qData

            return {
              getObjectActivity: qData.getObjectActivity.filter(
                (entry) => entry.id !== id
              ),
            }
          }
        )
      },
    })
  }

  // extract entries from the response
  const entries: ActivityLogEntry[] = data?.getObjectActivity || []

  return {
    entries,
    loading,
    error,
    addActivityMessage,
    resolveActivityLogEntry,
    deleteActivityMessage,
    isAddingMessage: addingMessage,
    isResolvingMessage: resolvingMessage,
    isDeletingMessage: deletingMessage,
    refetch,
  }
}
