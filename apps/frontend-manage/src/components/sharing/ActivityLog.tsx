import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { ActivityLogEntry, ObjectType } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, TextareaField } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useObjectActivity } from '../../lib/hooks/useObjectActivity'

dayjs.extend(relativeTime)

function ActivityLog({
  objectId,
  objectType,
  visible,
  className = '',
}: {
  objectId: string | number
  objectType: ObjectType
  visible?: boolean
  className?: string
}) {
  const t = useTranslations()
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    entries,
    loading: queryLoading,
    error: queryError,
    addActivityMessage,
    resolveActivityLogEntry,
    deleteActivityMessage,
    isAddingMessage: hookIsAddingMessage,
    isResolvingMessage: hookIsResolvingMessage,
    isDeletingMessage: hookIsDeletingMessage,
    refetch,
  } = useObjectActivity({
    objectId,
    objectType,
    visible,
  })

  // handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim() || !objectId) return

    setIsSubmitting(true)

    try {
      await addActivityMessage(message.trim())
      setMessage('')
    } catch (error) {
      console.error('[ActivityLog] Failed to submit message:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // determine which entries, loading and error states to use
  const loading = queryLoading
  const error = !!queryError
  const isAddingMessage = hookIsAddingMessage

  if (loading) {
    return (
      <div className="flex w-full flex-col rounded-md border p-4">
        <Loader />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex w-full flex-col rounded-md border border-red-300 bg-red-50 p-4">
        <div className="flex flex-col items-center justify-center">
          <p className="text-sm text-red-600">{t('shared.generic.error')}</p>
          {
            <button
              type="button"
              className="mt-2 text-xs text-blue-600 hover:underline"
              onClick={() => {
                refetch?.()
              }}
            >
              {t('shared.generic.tryAgain')}
            </button>
          }
        </div>
      </div>
    )
  }

  // group entries by date for better visual separation
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

  // get the dates in chronological order (olders to newest)
  const dates = Object.keys(groupedEntries).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  return (
    <div className="flex w-full flex-col">
      <div
        className={twMerge(
          'max-h-80 overflow-y-auto scroll-smooth p-2',
          className
        )}
        style={{ overscrollBehavior: 'contain' }}
        ref={(el) => {
          // scroll to bottom when component mounts or updates
          if (el && entries.length > 0) {
            el.scrollTop = el.scrollHeight
          }
        }}
      >
        <div className="flex flex-col space-y-2">
          {entries.length === 0 && (
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <div className="mb-2 text-4xl text-gray-300">📝</div>
              <p className="text-sm font-medium text-gray-500">
                {entries.length > 0
                  ? t('shared.comments.noUnresolvedActivity')
                  : t('shared.comments.noActivity')}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {t('shared.comments.addMessage')}
              </p>
            </div>
          )}

          {entries.length > 0 &&
            dates.map((date) => (
              <div key={date} className="flex flex-col space-y-3">
                <div className="my-1 text-center text-xs font-medium text-gray-500">
                  {dayjs(date).format('DD.MM.YYYY')}
                </div>

                {groupedEntries[date].map((entry) => {
                  if (entry.message !== null) {
                    return (
                      <div
                        key={entry.id}
                        className="group mb-2"
                        data-cy={`activity-log-entry-${entry.message}`}
                      >
                        <div className="rounded-lg border bg-white p-3 shadow-sm">
                          <div className="mb-2 flex flex-row items-center justify-between text-xs">
                            <div className="flex items-center">
                              <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                                {(entry.username !== ''
                                  ? entry.username
                                  : 'U')[0].toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-700">
                                {entry.username !== ''
                                  ? entry.username
                                  : t('shared.generic.unknownUser')}
                              </span>
                            </div>

                            <div
                              className={twMerge(
                                'ml-auto text-slate-400',
                                entry.isOwn && 'group-hover:hidden'
                              )}
                            >
                              {dayjs(entry.createdAt).format(
                                'DD.MM.YYYY HH:mm'
                              )}
                              {entry.isEdited && ' (edited)'}
                            </div>

                            <Button
                              basic
                              className={{
                                root: twMerge(
                                  'hidden px-3 py-0 text-red-600 hover:text-red-600',
                                  entry.isOwn && 'group-hover:block'
                                ),
                              }}
                              onClick={async () =>
                                await deleteActivityMessage(entry.id)
                              }
                              data={{ cy: 'activity-log-delete-message' }}
                            >
                              <Button.Icon withoutLabel icon={faTrashCan} />
                            </Button>
                          </div>

                          <div className="prose prose-sm w-full max-w-none break-words text-gray-700">
                            {entry.message}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // compose the message for creation / editing based on options
                  const entryMeesage =
                    entry.message ??
                    t(`shared.comments.message${entry.type}`, {
                      username: entry.username,
                      field: entry.options?.field
                        ? t(`shared.comments.field${entry.options.field}`)
                        : '',
                      oldValue: entry.options?.oldValue ?? '',
                      newValue: entry.options?.newValue ?? '',
                    })

                  return (
                    <div
                      key={entry.id}
                      className="flex flex-row items-center py-0.5 text-xs text-slate-500"
                      data-cy={`activity-log-entry-${entryMeesage}`}
                    >
                      <div className="grow break-words">{entryMeesage}</div>
                      <div className="ml-2 whitespace-nowrap pr-3 text-slate-400">
                        {dayjs(entry.createdAt).format('DD.MM.YYYY HH:mm')}
                        {entry.isEdited && ' (edited)'}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-2 flex flex-row items-end space-x-2 border-t pt-3"
      >
        <TextareaField
          placeholder={t('shared.comments.messageInputPlaceholder')}
          value={message}
          onChange={(text) => setMessage(text)}
          disabled={isSubmitting || isAddingMessage}
          data={{ cy: 'activity-log-input' }}
        />

        <Button
          type="submit"
          disabled={isSubmitting || isAddingMessage || !message.trim()}
          data={{ cy: 'activity-log-submit' }}
        >
          {isSubmitting || isAddingMessage
            ? t('shared.comments.sending')
            : t('shared.comments.send')}
        </Button>
      </form>
    </div>
  )
}

export default ActivityLog
