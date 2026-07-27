'use client'
import { makeAssistantToolUI } from '@assistant-ui/react'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { BookOpen } from 'lucide-react'
import { DOC_QUERY_TOOL_NAME } from '../../services/mcpScope'

type RAGSearchArgs = {
  query: string
  top_k?: number
}

type RAGSearchResult =
  | {
      result: string
    }
  | string

export const RAGToolUI = makeAssistantToolUI<RAGSearchArgs, RAGSearchResult>({
  toolName: DOC_QUERY_TOOL_NAME,
  render: ({ args, status, result }) => {
    if (status.type === 'running') {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4">
          <Loader basic />
          <span className="text-blue-800">
            Searching lecture content for: {args.query}...
          </span>
        </div>
      )
    }

    if (status.type === 'incomplete' && status.reason === 'error') {
      return (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <div className="font-semibold">Search Error</div>
          <div className="text-sm">
            Failed to search lecture content for: {args.query}
          </div>
        </div>
      )
    }

    if (typeof result === 'string' && result.startsWith('Error:')) {
      return (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <div className="font-semibold">RAG Search Error</div>
          <div className="text-sm">{result}</div>
        </div>
      )
    }

    if (!result || typeof result === 'string' || !result.result) {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4">
          <Loader basic />
          <span className="text-blue-800">
            Searching lecture content for: {args.query}...
          </span>
        </div>
      )
    }

    return (
      <div className="rag-card rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">Lecture Content</h3>
        </div>
        <div className="mb-3 text-sm text-blue-700">
          <strong>Question:</strong> {args.query}
        </div>
        <div className="rounded border bg-white p-3">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {typeof result === 'object' && result?.result
              ? result.result
              : 'No content available'}
          </div>
        </div>
      </div>
    )
  },
})
