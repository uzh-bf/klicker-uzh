import { useMutation, useQuery } from '@apollo/client'
import {
  ActivityLogEntry,
  ActivityLogType,
  AddActivityMessageDocument,
  GetObjectActivityDocument,
  ObjectType,
  ResolveActivityLogEntryDocument,
} from '@klicker-uzh/graphql/dist/ops'

export function useObjectActivity({
  objectId,
  objectType,
}: {
  objectId: string | number
  objectType: ObjectType
}) {
  // query for fetching activity entries using the unified query
  const { data, loading, error, refetch } = useQuery(
    GetObjectActivityDocument,
    {
      variables: { objectId: String(objectId), objectType },
      skip: !objectId,
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
      optimisticResponse: {
        addActivityMessage: {
          __typename: 'ActivityLogEntry',
          id: -1, // temporary ID that will be replaced by the server
          type: ActivityLogType.Message,
          objectType, // include this for consistency
          message,
          resolved: false,
          resolvedAt: null,
          username: 'self', // indicating it's the current user's message
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
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

  // extract entries from the response
  const entries: ActivityLogEntry[] = data?.getObjectActivity || []

  return {
    entries,
    loading,
    error,
    addActivityMessage,
    resolveActivityLogEntry,
    isAddingMessage: addingMessage,
    isResolvingMessage: resolvingMessage,
    refetch,
  }
}
