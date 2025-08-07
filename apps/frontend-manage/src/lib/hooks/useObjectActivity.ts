import { useMutation, useQuery } from '@apollo/client'
import {
  ActivityLogEntry,
  ActivityLogType,
  AddActivityMessageDocument,
  GetObjectActivityDocument,
  ObjectType,
  ResolveActivityLogEntryDocument,
} from '@klicker-uzh/graphql/dist/ops'

/**
 * A generic hook for fetching and managing activity entries for any object type
 * Uses a unified query that takes object type as a parameter
 *
 * @param options Options for the hook
 * @returns Object containing activity data, loading state, error state, and functions to add messages
 */
export function useObjectActivity({
  objectId,
  objectType,
}: {
  objectId: string | number
  objectType: ObjectType
}) {
  // debug logging for tracking purposes
  if (process.env.NODE_ENV !== 'production') {
    console.debug(
      `[useObjectActivity] Type: ${objectType}, Raw ID: ${objectId}, String ID: ${String(objectId)}`
    )
  }

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
  // TODO: add query update
  const [addMessage, { loading: addingMessage }] = useMutation(
    AddActivityMessageDocument
  )

  // mutation for resolving/unresolving messages
  // TODO: add query update
  const [resolveMessage, { loading: resolvingMessage }] = useMutation(
    ResolveActivityLogEntryDocument,
    {
      // TODO: implement proper cache update
    }
  )

  /**
   * Add a new message to the activity log
   *
   * @param message Message content to add
   * @returns Promise that resolves when the message is added
   */
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
        // Update the cache with the new message
        const existingData = cache.readQuery({
          query: GetObjectActivityDocument,
          variables: { objectId: String(objectId), objectType },
        })

        if (existingData && data?.addActivityMessage) {
          cache.writeQuery({
            query: GetObjectActivityDocument,
            variables: { objectId: String(objectId), objectType },
            data: {
              getObjectActivity: [
                ...(existingData.getObjectActivity || []),
                data.addActivityMessage,
              ],
            },
          })
        }
      },
    })
  }

  /**
   * Toggle the resolved status of a message
   *
   * @param id The ID of the activity log entry to resolve/unresolve
   * @param resolved Whether to set the status to resolved (true) or unresolved (false)
   * @returns Promise that resolves when the status is updated
   */
  const resolveActivityLogEntry = async (id: number, resolved: boolean) => {
    return resolveMessage({
      variables: {
        id,
      },
      optimisticResponse: {
        resolveActivityLogEntry: {
          __typename: 'ActivityLogEntry',
          id,
          resolved,
          // Set resolvedAt to current date if resolving, null if unresolving
          resolvedAt: resolved ? new Date().toISOString() : null,
        },
      },
      // TODO: add proper cache update here, once the corresponding mutation is implemented
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
