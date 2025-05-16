import { useMutation } from '@apollo/client'
import {
  AddChangelogMessageDocument,
  ChangelogEntry,
  ChangelogType,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useState } from 'react'

dayjs.extend(relativeTime)

interface ChangelogProps {
  entries: ChangelogEntry[]
  objectId: string
  objectType: ObjectType
  onMessageAdded?: () => void
}

function Changelog({
  entries,
  objectId,
  objectType,
  onMessageAdded,
}: ChangelogProps) {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Create mutation for adding a new message
  const [addChangelogMessage] = useMutation(AddChangelogMessageDocument, {
    onCompleted: () => {
      setMessage('')
      setIsSubmitting(false)
      if (onMessageAdded) onMessageAdded()
    },
    onError: (error) => {
      console.error('Error adding message:', error)
      setIsSubmitting(false)
    },
  })

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
    {} as Record<string, ChangelogEntry[]>
  )

  // Get the dates in reverse chronological order
  const dates = Object.keys(groupedEntries).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim()) return

    setIsSubmitting(true)

    try {
      await addChangelogMessage({
        variables: {
          objectId,
          objectType,
          message: message.trim(),
        },
      })
    } catch (error) {
      console.error('Failed to submit message:', error)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex w-full flex-col rounded-md border">
      <div className="flex-1 flex-col space-y-4 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="mb-2 text-4xl text-gray-300">📝</div>
            <p className="text-sm font-medium text-gray-500">
              {/* // TODO: translate */}
              No changelog entries yet.
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
                const isUserMessage = entry.type === ChangelogType.Message
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
          disabled={isSubmitting}
        />
        <button
          type="submit"
          className={`rounded-r-md bg-blue-500 px-4 py-2 text-sm font-medium text-white ${
            isSubmitting ? 'cursor-not-allowed opacity-70' : 'hover:bg-blue-600'
          }`}
          disabled={isSubmitting || !message.trim()}
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

export default Changelog
