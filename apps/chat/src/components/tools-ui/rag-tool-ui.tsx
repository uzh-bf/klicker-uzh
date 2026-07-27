'use client'
import { makeAssistantToolUI } from '@assistant-ui/react'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { BookOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'
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

function RAGToolCard({
  state,
  query,
  content,
}: {
  state: 'running' | 'error' | 'complete'
  query: string
  content?: string
}) {
  const t = useTranslations('pwa.chatbot.retrieval')

  if (state === 'running') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4">
        <Loader basic />
        <span className="text-blue-800">{t('searching', { query })}</span>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-800">
        <div className="font-semibold">{t('errorTitle')}</div>
        <div className="text-sm">{t('errorDescription')}</div>
      </div>
    )
  }

  return (
    <div className="rag-card rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-blue-900">{t('contentTitle')}</h3>
      </div>
      <div className="mb-3 text-sm text-blue-700">
        <strong>{t('questionLabel')}:</strong> {query}
      </div>
      <div className="rounded border bg-white p-3">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
          {content || t('noContent')}
        </div>
      </div>
    </div>
  )
}

export const RAGToolUI = makeAssistantToolUI<RAGSearchArgs, RAGSearchResult>({
  toolName: DOC_QUERY_TOOL_NAME,
  render: ({ args, status, result }) => {
    if (status.type === 'running') {
      return <RAGToolCard state="running" query={args.query} />
    }

    if (status.type === 'incomplete' && status.reason === 'error') {
      return <RAGToolCard state="error" query={args.query} />
    }

    if (typeof result === 'string' && result.startsWith('Error:')) {
      return <RAGToolCard state="error" query={args.query} />
    }

    if (!result || typeof result === 'string' || !result.result) {
      return <RAGToolCard state="running" query={args.query} />
    }

    return (
      <RAGToolCard
        state="complete"
        query={args.query}
        content={result.result}
      />
    )
  },
})
