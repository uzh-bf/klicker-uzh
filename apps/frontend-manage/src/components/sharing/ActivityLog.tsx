import { useMutation, useQuery } from '@apollo/client'
import {
  ActivityLogEntry,
  ActivityLogType,
  AddActivityMessageDocument,
  GetElementActivityDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useState } from 'react'

dayjs.extend(relativeTime)

export interface ActivityLogProps {
  // The ID of the object to fetch activity for
  objectId: string | number
  // The type of object (Element, Course, etc.)
  objectType: ObjectType
  // Optional entries for when not using internal data fetching
  entries?: ActivityLogEntry[]
  // Optional callback when a message is added
  onMessageAdded?: () => void
  // Optional flag for loading state (when not using internal data fetching)
  loading?: boolean
  // Optional flag for error state (when not using internal data fetching)
  error?: boolean
  // Optional function to add a message (when not using internal data fetching)
  onAddMessage?: (message: string) => Promise<any>
  // Optional flag for adding message state (when not using internal data fetching)
  isAddingMessage?: boolean
}

/**
 * A component that displays activity entries for an object (messages, modifications, etc.)
 * This component handles both the data fetching and the UI rendering
 */
function ActivityLog({
  objectId,
  objectType,
  entries: propEntries,
  onMessageAdded,
  loading: propLoading,
  error: propError,
  onAddMessage: propOnAddMessage,
  isAddingMessage: propIsAddingMessage,
}: ActivityLogProps) {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Ensure objectId is a string for GraphQL operations
  const stringObjectId = objectId?.toString() || ''

  // Convert string ID to number for element queries if needed
  const queryId =
    objectType === ObjectType.Element && typeof objectId === 'string'
      ? parseInt(objectId)
      : objectId

  // Determine if we should use internal data fetching
  const useInternalDataFetching = propEntries === undefined

  // Query for fetching activity log entries (only if entries not provided)
  const {
    data,
    loading: queryLoading,
    error: queryError,
    refetch,
  } = useQuery(GetElementActivityDocument, {
    variables: { id: Number(queryId) },
    fetchPolicy: 'cache-and-network',
    skip: !useInternalDataFetching || !objectId,
  })

  // Mutation for adding messages
  const [addMessage, { loading: mutationLoading }] = useMutation(
    AddActivityMessageDocument,
    {
      onCompleted: () => {
        // Refetch to update the activity log
        if (refetch) refetch()
        if (onMessageAdded) onMessageAdded()
      },
      onError: (error) => {
        console.error('Error adding message:', error)
      },
    }
  )

  /**
   * Add a new message to the activity log
   */
  const handleAddMessage = async (messageText: string) => {
    if (!objectId) return

    if (propOnAddMessage) {
      return propOnAddMessage(messageText)
    }

    return addMessage({
      variables: {
        objectId: stringObjectId,
        objectType,
        message: messageText,
      },
    })
  }

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim()) return

    setIsSubmitting(true)

    try {
      await handleAddMessage(message.trim())
      setMessage('')
    } catch (error) {
      console.error('Failed to submit message:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Determine which entries, loading and error states to use
  const entries = useInternalDataFetching
    ? (data?.getElementActivity ?? [])
    : propEntries || []

  const loading = useInternalDataFetching ? queryLoading : propLoading || false
  const error = useInternalDataFetching ? !!queryError : propError || false
  const isAddingMessage = useInternalDataFetching
    ? mutationLoading
    : propIsAddingMessage || false

  // Render loading state
  if (loading) {
    return (
      <div className="flex w-full flex-col rounded-md border p-4">
        <div className="flex items-center justify-center">
          <p className="text-sm text-gray-500">Loading activity...</p>
        </div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className="flex w-full flex-col rounded-md border border-red-300 bg-red-50 p-4">
        <div className="flex flex-col items-center justify-center">
          <p className="text-sm text-red-600">Failed to load activity log</p>
          <button
            className="mt-2 text-xs text-blue-600 hover:underline"
            onClick={() => {
              if (useInternalDataFetching) {
                refetch()
              } else {
                onMessageAdded?.()
              }
            }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // Group entries by date for better visual separation
  const groupedEntries = entries.reduce(
    (acc, entry) => {
      const date = new Date(entry.createdAt).toDateString()
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(entry)
      return acc
    },
    {} as Record<string, ActivityLogEntry[]>
  )

  // Get the dates in reverse chronological order
  const dates = Object.keys(groupedEntries).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )

  return (
    <div className="flex w-full flex-col rounded-md border">
      <div className="max-h-80 flex-1 flex-col space-y-4 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="mb-2 text-4xl text-gray-300">📝</div>
            <p className="text-sm font-medium text-gray-500">
              {/* // TODO: translate */}
              No activity yet.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {/* // TODO: translate */}
              Use the form below to add the first message.
            </p>
          </div>
        ) : (
          dates.map((date) => (
            <div key={date} className="flex flex-col space-y-3">
              <div className="flex justify-center">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-gray-500">
                  {new Date(date).toLocaleDateString()}
                </span>
              </div>

              {groupedEntries[date].map((entry) => {
                const isUserMessage = entry.type === ActivityLogType.Message
                const isOwnMessage = entry.username === 'self' // Replace with actual logic to check if message is from current user

                return (
                  <div
                    key={entry.id}
                    className={`flex ${isUserMessage ? (isOwnMessage ? 'justify-end' : 'justify-start') : 'justify-center'} w-full`}
                  >
                    <div
                      className={` ${
                        isUserMessage
                          ? isOwnMessage
                            ? 'max-w-[85%] self-end rounded-lg bg-blue-500 px-3 py-2 text-base text-white'
                            : 'max-w-[85%] self-start rounded-lg bg-slate-200 px-3 py-2 text-base'
                          : 'w-full max-w-[90%] self-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-gray-600'
                      } `}
                    >
                      {isUserMessage && !isOwnMessage && (
                        <div className="mb-1 text-xs font-medium text-gray-700">
                          {entry.username || 'Unknown user'}
                        </div>
                      )}
                      <div className="break-words">{entry.message}</div>
                      <div
                        className={`mt-1 text-right ${
                          isUserMessage
                            ? isOwnMessage
                              ? 'text-xs text-blue-200'
                              : 'text-xs text-gray-600'
                            : 'text-[10px] text-gray-500'
                        }`}
                      >
                        {dayjs(entry.createdAt).fromNow()}
                        {entry.isEdited && ' (edited)'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Message input form */}
      <form onSubmit={handleSubmit} className="flex items-center border-t p-2">
        <input
          type="text"
          className="flex-1 rounded-l-md border-r-0 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isSubmitting || isAddingMessage}
        />
        <button
          type="submit"
          className={`rounded-r-md bg-blue-500 px-4 py-2 text-sm font-medium text-white ${
            isSubmitting || isAddingMessage || !message.trim()
              ? 'cursor-not-allowed opacity-70'
              : 'hover:bg-blue-600'
          }`}
          disabled={isSubmitting || isAddingMessage || !message.trim()}
        >
          {isSubmitting || isAddingMessage ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

export default ActivityLog
