'use client'
import { makeAssistantToolUI } from '@assistant-ui/react'
import { Cloud, Droplets, Loader2 } from 'lucide-react'

type WeatherArgs = {
  location: string
}

type WeatherResult = {
  result: {
    temp: number
    humidity: string
  }
}

export const WeatherToolUI = makeAssistantToolUI<WeatherArgs, WeatherResult>({
  toolName: 'getWeather',
  render: ({ args, status, result }) => {
    if (status.type === 'running') {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-blue-800">
            Getting weather for {args.location}...
          </span>
        </div>
      )
    }

    if (status.type === 'incomplete' && status.reason === 'error') {
      return (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          Failed to get weather for {args.location}
        </div>
      )
    }

    if (!result || !result.result) {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-blue-800">
            Getting weather for {args.location}...
          </span>
        </div>
      )
    }

    return (
      <div className="weather-card rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <Cloud className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">{args.location}</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-blue-800">
              {result?.result?.temp || 'N/A'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-700">
              {result?.result?.humidity || 'N/A'}
            </span>
          </div>
        </div>
      </div>
    )
  },
})
