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
 * Options for the useObjectActivity hook
 */
interface UseObjectActivityOptions {
  /** The ID of the object to fetch activity for (can be string or number) */
  objectId?: string | number
  /** The type of object (Element, Course, etc.) */
  objectType: ObjectType
  /** Whether to skip the query (e.g., when ID is not available) */
  skip?: boolean
  /** Custom fetch policy for the Apollo query */
  fetchPolicy?: 'cache-first' | 'network-only' | 'cache-and-network'
}

/**
 * Determines if the object type uses a numeric ID
 */
function isNumericIdType(objectType: ObjectType): boolean {
  return (
    objectType === ObjectType.Element ||
    objectType === ObjectType.AnswerCollection
  )
}

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
  skip = false,
  fetchPolicy = 'cache-and-network',
}: UseObjectActivityOptions) {
  // Skip if no valid ID is provided
  const shouldSkip = skip || !objectId

  // Convert all IDs to string for the unified query
  // (the backend will handle conversion to the appropriate type)
  const stringId = objectId ? String(objectId) : ''

  // Debug logging for tracking purposes
  if (process.env.NODE_ENV !== 'production') {
    console.debug(
      `[useObjectActivity] Type: ${objectType}, Raw ID: ${objectId}, String ID: ${stringId}`
    )
  }

  // Query for fetching activity entries using the unified query
  const { data, loading, error, refetch } = useQuery(
    GetObjectActivityDocument,
    {
      variables: {
        objectId: stringId,
        objectType,
      },
      skip: shouldSkip,
      fetchPolicy,
      // Add error handling to help debug issues
      onError: (err) => {
        console.error(
          `[useObjectActivity] Error fetching activity for ${objectType} (ID: ${stringId}):`,
          err
        )
      },
    }
  )

  // Mutation for adding messages
  const [addMessage, { loading: addingMessage }] = useMutation(
    AddActivityMessageDocument,
    {
      onCompleted: () => {
        // Refetch the activity log to include the new message
        refetch()
      },
      onError: (error) => {
        console.error(
          `[useObjectActivity] Error adding message to ${objectType} (ID: ${stringId}):`,
          error
        )
      },
    }
  )

  // Mutation for resolving/unresolving messages
  const [resolveMessage, { loading: resolvingMessage }] = useMutation(
    ResolveActivityLogEntryDocument,
    {
      onCompleted: () => {
        // Refetch the activity log to reflect the update
        refetch()
      },
      onError: (error) => {
        console.error(`[useObjectActivity] Error resolving message:`, error)
      },
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

    // All IDs are sent as strings in the mutation
    const stringId =
      typeof objectId === 'number' ? objectId.toString() : objectId

    return addMessage({
      variables: {
        objectId: stringId,
        objectType,
        message,
      },
      // Use optimistic response for better UX
      optimisticResponse: {
        addActivityMessage: {
          __typename: 'ActivityLogEntry',
          id: -1, // Temporary ID that will be replaced by the server
          type: ActivityLogType.Message,
          objectType, // Include this for consistency
          message,
          resolved: false,
          resolvedAt: null,
          username: 'self', // Indicating it's the current user's message
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
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
      // Use optimistic response for better UX
      optimisticResponse: {
        resolveActivityLogEntry: {
          __typename: 'ActivityLogEntry',
          id,
          resolved,
          // Set resolvedAt to current date if resolving, null if unresolving
          resolvedAt: resolved ? new Date().toISOString() : null,
        },
      },
    })
  }

  // Extract entries from the response
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
