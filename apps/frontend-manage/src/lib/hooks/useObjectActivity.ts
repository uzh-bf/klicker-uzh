import { useMutation, useQuery } from '@apollo/client'
import {
  ActivityLogEntry,
  AddActivityMessageDocument,
  GetObjectActivityDocument,
  ObjectType,
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
  return objectType === ObjectType.Element || objectType === ObjectType.AnswerCollection
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
    console.debug(`[useObjectActivity] Type: ${objectType}, Raw ID: ${objectId}, String ID: ${stringId}`)
  }

  // Query for fetching activity entries using the unified query
  const { data, loading, error, refetch } = useQuery(GetObjectActivityDocument, {
    variables: { 
      objectId: stringId,
      objectType,
    },
    skip: shouldSkip,
    fetchPolicy,
    // Add error handling to help debug issues
    onError: (err) => {
      console.error(`[useObjectActivity] Error fetching activity for ${objectType} (ID: ${stringId}):`, err)
    },
  })

  // Mutation for adding messages
  const [addMessage, { loading: addingMessage }] = useMutation(
    AddActivityMessageDocument,
    {
      onCompleted: () => {
        // Refetch the activity log to include the new message
        refetch()
      },
      onError: (error) => {
        console.error(`[useObjectActivity] Error adding message to ${objectType} (ID: ${stringId}):`, error)
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
      console.error('[useObjectActivity] Cannot add message - objectId is undefined')
      return
    }

    // All IDs are sent as strings in the mutation
    const stringId = typeof objectId === 'number' ? objectId.toString() : objectId

    return addMessage({
      variables: {
        objectId: stringId,
        objectType,
        message,
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
    isAddingMessage: addingMessage,
    refetch,
  }
}