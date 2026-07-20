'use client'
import { makeAssistantToolUI } from '@assistant-ui/react'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { BookOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'

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
  toolName: 'KB.doc_query',
  render: ({ args, status, result }) => {
    const t = useTranslations()

    if (status.type === 'running') {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4">
          <Loader basic />
          <span className="text-blue-800">
            {t('chat.tools.rag.searching', { query: args.query })}
          </span>
        </div>
      )
    }

    if (status.type === 'incomplete' && status.reason === 'error') {
      return (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <div className="font-semibold">
            {t('chat.tools.rag.searchErrorTitle')}
          </div>
          <div className="text-sm">
            {t('chat.tools.rag.searchErrorMessage', { query: args.query })}
          </div>
        </div>
      )
    }

    if (typeof result === 'string' && result.startsWith('Error:')) {
      return (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <div className="font-semibold">{t('chat.tools.rag.errorTitle')}</div>
          <div className="text-sm">{result}</div>
        </div>
      )
    }

    if (!result || typeof result === 'string' || !result.result) {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4">
          <Loader basic />
          <span className="text-blue-800">
            {t('chat.tools.rag.searching', { query: args.query })}
          </span>
        </div>
      )
    }

    return (
      <div className="rag-card rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">
            {t('chat.tools.rag.resultTitle')}
          </h3>
        </div>
        <div className="mb-3 text-sm text-blue-700">
          <strong>{t('chat.tools.rag.questionLabel')}</strong> {args.query}
        </div>
        <div className="rounded border bg-white p-3">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {typeof result === 'object' && result?.result
              ? result.result
              : t('chat.tools.rag.noContent')}
          </div>
        </div>
      </div>
    )
  },
})
