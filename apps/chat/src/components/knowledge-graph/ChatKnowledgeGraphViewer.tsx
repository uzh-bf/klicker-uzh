'use client'

import type { KnowledgeGraphDataSource } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import type { KnowledgeGraphAskSelection } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphView'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'

const DynamicKnowledgeGraphViewer = dynamic(
  () =>
    import(
      '@klicker-uzh/shared-components/src/knowledgeGraph/KnowledgeGraphViewer'
    ).then((module) => module.KnowledgeGraphViewer),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-[#E9E9E9] bg-white p-6 text-center text-[#4C4C4C]"
        role="status"
        data-cy="chat-knowledge-graph-loading"
      >
        Loading knowledge graph…
      </div>
    ),
  }
)

export function ChatKnowledgeGraphViewer({
  dataSource,
  onAsk,
}: {
  dataSource: KnowledgeGraphDataSource
  onAsk?: (selection: KnowledgeGraphAskSelection) => void
}) {
  const t = useTranslations('chat.graphPanel')
  return (
    <DynamicKnowledgeGraphViewer
      dataSource={dataSource}
      onAsk={onAsk}
      labels={{
        details: { ask: t('ask'), missingEndpoint: t('missingEndpoint') },
      }}
      detailsLayout="contained"
      preserveViewportOnResize
      initialView="overview"
      searchSuggestions
      overviewNavigation
      unavailableMessage="The knowledge graph is not available yet. Please try again later or contact your lecturer."
      className="!min-h-0 flex-1"
    />
  )
}
