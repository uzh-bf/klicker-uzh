import {
  ActivityLogEntry,
  ActivityLogType,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, TextareaField } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useObjectActivity } from '../../lib/hooks/useObjectActivity'

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
  // Optional function to resolve/unresolve a message (when not using internal data fetching)
  onResolveMessage?: (id: number, resolved: boolean) => Promise<any>
  // Optional flag for resolving message state (when not using internal data fetching)
  isResolvingMessage?: boolean
  // Optional flag to show/hide resolved messages
  showResolved?: boolean
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
  onResolveMessage: propOnResolveMessage,
  isResolvingMessage: propIsResolvingMessage,
  showResolved = true,
}: ActivityLogProps) {
  const t = useTranslations()
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterResolved, setFilterResolved] = useState(!showResolved)

  // Determine if we should use internal data fetching
  const useInternalDataFetching = propEntries === undefined

  // Log object information in development
  if (process.env.NODE_ENV !== 'production') {
    console.debug(
      `[ActivityLog] objectType: ${objectType}, objectId: ${objectId}, using internal fetching: ${useInternalDataFetching}`
    )
  }

  // Use the generic hook for activity log handling
  const {
    entries: hookEntries,
    loading: queryLoading,
    error: queryError,
    addActivityMessage,
    resolveActivityLogEntry,
    isAddingMessage: hookIsAddingMessage,
    isResolvingMessage: hookIsResolvingMessage,
    refetch,
  } = useObjectActivity({
    objectId,
    objectType,
    skip: !useInternalDataFetching || !objectId,
    fetchPolicy: 'cache-and-network',
  })

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim() || !objectId) return

    setIsSubmitting(true)

    try {
      if (propOnAddMessage) {
        await propOnAddMessage(message.trim())
      } else {
        await addActivityMessage(message.trim())
      }

      if (onMessageAdded) onMessageAdded()
      setMessage('')
    } catch (error) {
      console.error('[ActivityLog] Failed to submit message:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle resolving/unresolving a message
  const handleResolve = async (id: number, currentResolvedStatus: boolean) => {
    try {
      if (propOnResolveMessage) {
        await propOnResolveMessage(id, !currentResolvedStatus)
      } else {
        await resolveActivityLogEntry(id, !currentResolvedStatus)
      }
    } catch (error) {
      console.error('[ActivityLog] Failed to toggle resolved status:', error)
    }
  }

  // Determine which entries, loading and error states to use
  const allEntries = useInternalDataFetching ? hookEntries : propEntries || []
  const loading = useInternalDataFetching ? queryLoading : propLoading || false
  const error = useInternalDataFetching ? !!queryError : propError || false
  const isAddingMessage = useInternalDataFetching
    ? hookIsAddingMessage
    : propIsAddingMessage || false
  const isResolvingMessage = useInternalDataFetching
    ? hookIsResolvingMessage
    : propIsResolvingMessage || false

  // Filter out resolved messages if needed
  const entries = filterResolved
    ? allEntries.filter(
        (entry) => entry.type !== ActivityLogType.Message || !entry.resolved
      )
    : allEntries

  // Render loading state
  if (loading) {
    return (
      <div className="flex w-full flex-col rounded-md border p-4">
        <div className="flex items-center justify-center">
          <p className="text-sm text-gray-500">{t('shared.generic.loading')}</p>
        </div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className="flex w-full flex-col rounded-md border border-red-300 bg-red-50 p-4">
        <div className="flex flex-col items-center justify-center">
          <p className="text-sm text-red-600">{t('shared.generic.error')}</p>
          {
            <button
              className="mt-2 text-xs text-blue-600 hover:underline"
              onClick={() => {
                if (useInternalDataFetching) {
                  refetch?.()
                } else {
                  onMessageAdded?.()
                }
              }}
            >
              {t('shared.generic.tryAgain')}
            </button>
          }
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
    <div className="flex w-full flex-col">
      {/* Filter toggle */}
      {/* <div className="flex justify-end border-b p-2">
        <label className="flex items-center text-xs text-gray-600">
          <input
            type="checkbox"
            checked={filterResolved}
            onChange={() => setFilterResolved(!filterResolved)}
            className="mr-2 h-3 w-3"
          />
          {t('shared.activity.hideResolved')}
        </label>
      </div> */}

      <div className="max-h-80 flex-1 flex-col space-y-4 overflow-y-auto p-2">
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="mb-2 text-4xl text-gray-300">📝</div>
            <p className="text-sm font-medium text-gray-500">
              {filterResolved && allEntries.length > 0
                ? t('shared.activity.noUnresolvedActivity')
                : t('shared.activity.noActivity')}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {t('shared.activity.addMessage')}
            </p>
          </div>
        )}

        {entries.length > 0 &&
          dates.map((date) => (
            <div key={date} className="flex flex-col space-y-3">
              <div className="bg-slate-100 px-3 py-1 text-center text-sm text-gray-500">
                {dayjs(date).format('DD.MM.YYYY')}
              </div>

              {groupedEntries[date].map((entry) => {
                const isUserMessage = entry.type === ActivityLogType.Message
                const isOwnMessage = entry.username === 'self' // Replace with actual logic to check if message is from current user
                const isResolved = entry.resolved

                return (
                  <div key={entry.id} className="border-b pb-2 last:border-b-0">
                    <div>
                      <div className="flex flex-row items-center justify-between text-xs text-slate-500">
                        <div>
                          {isUserMessage && (
                            <div>
                              {!isOwnMessage && (
                                <div>{entry.username || 'Unknown user'}</div>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          {dayjs(entry.createdAt).fromNow()}
                          {entry.isEdited && ' (edited)'}
                        </div>
                      </div>

                      <div className="prose prose-sm w-full max-w-none break-words">
                        {entry.message}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-row items-end space-x-2"
      >
        <TextareaField
          placeholder={t('shared.activity.messageInputPlaceholder')}
          value={message}
          onChange={(text) => setMessage(text)}
          disabled={isSubmitting || isAddingMessage}
        />

        <Button
          type="submit"
          disabled={isSubmitting || isAddingMessage || !message.trim()}
        >
          {isSubmitting || isAddingMessage
            ? t('shared.activity.sending')
            : t('shared.activity.send')}
        </Button>
      </form>
    </div>
  )
}

export default ActivityLog
