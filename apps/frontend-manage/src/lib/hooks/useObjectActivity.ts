import { useMutation, useQuery } from '@apollo/client'
import {
  ActivityLogEntry,
  AddActivityMessageDocument,
  GetAnswerCollectionActivityDocument,
  GetCourseActivityDocument,
  GetElementActivityDocument,
  GetGroupActivityActivityDocument,
  GetLiveQuizActivityDocument,
  GetMicroLearningActivityDocument,
  GetPracticeQuizActivityDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { DocumentNode } from 'graphql'

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
 * Gets the appropriate GraphQL document for fetching activity based on object type
 */
function getQueryDocumentForObjectType(objectType: ObjectType): DocumentNode {
  switch (objectType) {
    case ObjectType.Element:
      return GetElementActivityDocument
    case ObjectType.Course:
      return GetCourseActivityDocument
    case ObjectType.LiveQuiz:
      return GetLiveQuizActivityDocument
    case ObjectType.PracticeQuiz:
      return GetPracticeQuizActivityDocument
    case ObjectType.MicroLearning:
      return GetMicroLearningActivityDocument
    case ObjectType.GroupActivity:
      return GetGroupActivityActivityDocument
    case ObjectType.AnswerCollection:
      return GetAnswerCollectionActivityDocument
    default:
      // Fallback for new object types that might be added in the future
      console.warn(`Unsupported object type: ${objectType}, defaulting to Element activity document`)
      return GetElementActivityDocument
  }
}

/**
 * Gets the result field name for extracting activity data from the query response
 */
function getResultFieldName(objectType: ObjectType): string {
  switch (objectType) {
    case ObjectType.Element:
      return 'getElementActivity'
    case ObjectType.Course:
      return 'getCourseActivity'
    case ObjectType.LiveQuiz:
      return 'getLiveQuizActivity'
    case ObjectType.PracticeQuiz:
      return 'getPracticeQuizActivity'
    case ObjectType.MicroLearning:
      return 'getMicroLearningActivity'
    case ObjectType.GroupActivity:
      return 'getGroupActivityActivity'
    case ObjectType.AnswerCollection:
      return 'getAnswerCollectionActivity'
    default:
      // Fallback for new object types
      return 'getElementActivity'
  }
}

/**
 * Determines if the object type uses a numeric ID
 */
function isNumericIdType(objectType: ObjectType): boolean {
  return objectType === ObjectType.Element || objectType === ObjectType.AnswerCollection
}

/**
 * A generic hook for fetching and managing activity entries for any object type
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

  // Convert ID to appropriate type based on object type
  const normalizedId = objectId 
    ? isNumericIdType(objectType)
      ? typeof objectId === 'string' 
        ? parseInt(objectId, 10) 
        : objectId
      : String(objectId)
    : isNumericIdType(objectType) 
      ? 0 
      : ''
  
  // Debug logging for tracking purposes
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[useObjectActivity] Type: ${objectType}, Raw ID: ${objectId}, Normalized ID: ${normalizedId}`)
  }

  // Get the appropriate query document for this object type
  const queryDocument = getQueryDocumentForObjectType(objectType)

  // Query for fetching activity entries
  const { data, loading, error, refetch } = useQuery(queryDocument, {
    variables: { id: normalizedId },
    skip: shouldSkip,
    fetchPolicy,
    // Add error handling to help debug issues
    onError: (err) => {
      console.error(`[useObjectActivity] Error fetching activity for ${objectType} (ID: ${normalizedId}):`, err)
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
        console.error(`[useObjectActivity] Error adding message to ${objectType} (ID: ${normalizedId}):`, error)
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

    // Convert numeric IDs to string for the mutation
    const stringId = typeof objectId === 'number' ? objectId.toString() : objectId

    return addMessage({
      variables: {
        objectId: stringId,
        objectType,
        message,
      },
    })
  }

  // Extract entries from the appropriate field in the response
  const resultFieldName = getResultFieldName(objectType)
  const entries: ActivityLogEntry[] = data?.[resultFieldName] || []

  return {
    entries,
    loading,
    error,
    addActivityMessage,
    isAddingMessage: addingMessage,
    refetch,
  }
}