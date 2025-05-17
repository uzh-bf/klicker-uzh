import { useMutation, useQuery } from '@apollo/client'
import {
  AddActivityMessageDocument,
  GetElementActivityDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'

interface UseElementActivityOptions {
  id?: number
  skip?: boolean
}

/**
 * Hook for fetching and managing activity entries for an element
 *
 * @param options Options for the hook
 * @param options.id Element ID to fetch activity for
 * @param options.skip Whether to skip the query (e.g., when ID is not available)
 * @returns Object containing activity data, loading state, error state, and functions to add messages
 */
export function useElementActivity({
  id,
  skip = false,
}: UseElementActivityOptions) {
  // Query for fetching element changelog entries
  const { data, loading, error, refetch } = useQuery(
    GetElementActivityDocument,
    {
      variables: { id: id || 0 },
      skip: skip || !id,
      fetchPolicy: 'cache-and-network',
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
        console.error('Error adding message:', error)
      },
    }
  )

  /**
   * Add a new message to the element activity log
   *
   * @param message Message content to add
   * @returns Promise that resolves when the message is added
   */
  const addActivityMessage = async (message: string) => {
    if (!id) return

    return addMessage({
      variables: {
        objectId: id.toString(),
        objectType: ObjectType.Element,
        message,
      },
    })
  }

  return {
    entries: data?.getElementActivity || [],
    loading,
    error,
    addActivityMessage,
    isAddingMessage: addingMessage,
    refetch,
  }
}
