'use client'
import { makeAssistantToolUI } from '@assistant-ui/react'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Book, Search, Star } from 'lucide-react'

type Context7Args = {
  libraryName?: string
  context7CompatibleLibraryID?: string
  topic?: string
  tokens?: number
  type?: 'txt' | 'json'
}

type Context7Result =
  | {
      // direct library ID result
      libraryId: string
      topic?: string
      content: string
    }
  | {
      // search result
      libraryName: string
      libraryId: string
      description: string
      trustScore: number
      stars: number
      topic?: string
      content: string
      searchResults: Array<{
        id: string
        title: string
        description: string
        stars: number
        trustScore: number
      }>
    }
  | {
      error: string
      searchResults: Array<{
        id: string
        title: string
        description: string
        stars: number
        trustScore: number
      }>
    }
  | string

export const Context7ToolUI = makeAssistantToolUI<Context7Args, Context7Result>(
  {
    toolName: 'context7',
    render: ({ args, status, result }) => {
      if (status.type === 'running') {
        return (
          <div className="flex items-center gap-2 rounded-lg bg-purple-50 p-4">
            <Loader basic />
            <span className="text-purple-800">
              {args.libraryName
                ? `Searching for ${args.libraryName}...`
                : 'Fetching documentation...'}
            </span>
          </div>
        )
      }

      if (status.type === 'incomplete' && status.reason === 'error') {
        return (
          <div className="rounded-lg bg-red-50 p-4 text-red-800">
            <div className="font-semibold">Context7 Error</div>
            <div className="text-sm">Failed to fetch documentation</div>
          </div>
        )
      }

      if (typeof result === 'string' && result.startsWith('Error:')) {
        return (
          <div className="rounded-lg bg-red-50 p-4 text-red-800">
            <div className="font-semibold">Context7 Error</div>
            <div className="text-sm">{result}</div>
          </div>
        )
      }

      if (!result || typeof result === 'string') {
        return (
          <div className="flex items-center gap-2 rounded-lg bg-purple-50 p-4">
            <Loader basic />
            <span className="text-purple-800">
              {args.libraryName
                ? `Searching for ${args.libraryName}...`
                : 'Processing...'}
            </span>
          </div>
        )
      }

      console.log('Context7 Tool Result:', result)

      // Handle error case in object result
      if (typeof result === 'object' && result && 'error' in result) {
        return (
          <div className="rounded-lg bg-red-50 p-4 text-red-800">
            <div className="font-semibold">No Results Found</div>
            <div className="text-sm">{result.error}</div>
          </div>
        )
      }

      if (typeof result !== 'object' || !result || !result.content) {
        return (
          <div className="flex items-center gap-2 rounded-lg bg-purple-50 p-4">
            <Loader basic />
            <span className="text-purple-800">
              {args.libraryName
                ? `Searching for ${args.libraryName}...`
                : 'Processing...'}
            </span>
          </div>
        )
      }

      const isRichResult = 'libraryName' in result && 'description' in result
      const displayTitle = isRichResult
        ? result.libraryName
        : result.libraryId.split('/').pop()

      return (
        <div className="context7-card rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Book className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-purple-900">{displayTitle}</h3>
            </div>
            {isRichResult && (
              <div className="flex items-center gap-2 text-sm text-purple-700">
                {result.stars > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    <span>{result.stars}</span>
                  </div>
                )}
                {result.trustScore && (
                  <div className="rounded bg-purple-200 px-2 py-1 text-xs">
                    Trust: {result.trustScore}/10
                  </div>
                )}
              </div>
            )}
          </div>

          {isRichResult && result.description && (
            <p className="mb-3 text-sm text-purple-700">{result.description}</p>
          )}

          <div className="mb-3 flex flex-wrap gap-2 text-xs text-purple-600">
            <span className="rounded bg-purple-200 px-2 py-1">
              ID: {result.libraryId}
            </span>
            {result.topic && (
              <span className="rounded bg-purple-200 px-2 py-1">
                Topic: {result.topic}
              </span>
            )}
          </div>

          <div className="rounded bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Documentation
              </span>
              <span className="text-xs text-gray-500">
                {result.content.length} chars
              </span>
            </div>
            <div className="max-h-32 overflow-y-auto rounded bg-gray-50 p-2 font-mono text-xs">
              {result.content.substring(0, 10000)}
              {result.content.length > 10000 && '...'}
            </div>
          </div>

          {isRichResult &&
            result.searchResults &&
            result.searchResults.length > 1 && (
              <div className="mt-3">
                <div className="mb-2 flex items-center gap-1 text-sm font-medium text-purple-700">
                  <Search className="h-3 w-3" />
                  Other Results
                </div>
                <div className="space-y-1">
                  {result.searchResults.slice(1).map((searchResult, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded bg-purple-50 p-2 text-xs"
                    >
                      <span className="font-medium">{searchResult.title}</span>
                      <div className="flex items-center gap-2 text-purple-600">
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          <span>{searchResult.stars}</span>
                        </div>
                        <span>Trust: {searchResult.trustScore}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )
    },
  }
)
