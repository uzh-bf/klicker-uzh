'use client'
import { makeAssistantToolUI } from '@assistant-ui/react'
import { Clock, Loader2 } from 'lucide-react'

type TimeArgs = Record<string, never>

type TimeResult = string

export const TimeToolUI = makeAssistantToolUI<TimeArgs, TimeResult>({
  toolName: 'get_time',
  render: ({ status, result }) => {
    if (status.type === 'running') {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-purple-50 p-4">
          <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
          <span className="text-purple-800">Getting current time...</span>
        </div>
      )
    }

    if (status.type === 'incomplete' && status.reason === 'error') {
      return (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          Failed to get current time
        </div>
      )
    }

    if (!result) {
      return null
    }

    return (
      <div className="time-card rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-purple-600" />
          <div>
            <h3 className="font-semibold text-purple-900">Current Time</h3>
            <p className="font-mono text-lg text-purple-800">{result}</p>
          </div>
        </div>
      </div>
    )
  },
})
