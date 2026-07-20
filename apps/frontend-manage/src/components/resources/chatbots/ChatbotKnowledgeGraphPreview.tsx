import { ApolloError, useApolloClient } from '@apollo/client'
import {
  GetChatbotKnowledgeGraphNeighborsDocument,
  GetChatbotKnowledgeGraphOverviewDocument,
  SearchChatbotKnowledgeGraphDocument,
} from '@klicker-uzh/graphql/dist/ops'
import type { KnowledgeGraphViewerLabelOverrides } from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphLabels'
import {
  KnowledgeGraphUnavailableError,
  type KnowledgeGraphDataSource,
} from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphState'
import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useMemo } from 'react'

const KnowledgeGraphViewer = dynamic(
  () =>
    import(
      '@klicker-uzh/shared-components/src/knowledgeGraph/KnowledgeGraphViewer'
    ),
  { ssr: false }
)

type GraphResponse = {
  chatbotId: string
  builtRevision: number
  truncated: boolean
  nodes: Array<{
    id: string
    labels: string[]
    kind: string
    displayLabel: string
    summary?: string | null
    content?: string | null
    degree: number
    sourceReferences: Array<{
      resourceId: string
      title: string
      reference?: string | null
    }>
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    type: string
    label: string
    properties: unknown
  }>
}

function toKnowledgeGraphResponse(
  response: GraphResponse
): KnowledgeGraphResponse {
  return {
    chatbotId: response.chatbotId,
    builtRevision: response.builtRevision,
    truncated: response.truncated,
    nodes: response.nodes.map((node) => ({
      id: node.id,
      labels: node.labels,
      kind: node.kind,
      displayLabel: node.displayLabel,
      ...(node.summary === null || node.summary === undefined
        ? {}
        : { summary: node.summary }),
      ...(node.content === null || node.content === undefined
        ? {}
        : { content: node.content }),
      degree: node.degree,
      sourceReferences: node.sourceReferences.map((reference) => ({
        resourceId: reference.resourceId,
        title: reference.title,
        ...(reference.reference === null || reference.reference === undefined
          ? {}
          : { reference: reference.reference }),
      })),
    })),
    edges: response.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      label: edge.label,
      properties: edge.properties as Record<string, string | number | boolean>,
    })),
  }
}

function normalizePreviewError(error: unknown): never {
  if (
    error instanceof ApolloError &&
    error.graphQLErrors.some(
      (graphQLError) =>
        graphQLError.extensions?.code === 'KNOWLEDGE_GRAPH_NOT_PUBLISHED'
    )
  ) {
    throw new KnowledgeGraphUnavailableError()
  }

  throw error
}

function ChatbotKnowledgeGraphPreview({
  chatbotId,
  builtRevision,
}: {
  chatbotId: string
  builtRevision: number
}) {
  const t = useTranslations()
  const apolloClient = useApolloClient()
  const labels = useMemo<KnowledgeGraphViewerLabelOverrides>(
    () => ({
      explorerAriaLabel: t(
        'manage.resources.knowledgeGraphViewer.explorerAriaLabel'
      ),
      searchAriaLabel: t(
        'manage.resources.knowledgeGraphViewer.searchAriaLabel'
      ),
      searchLabel: t('manage.resources.knowledgeGraphViewer.searchLabel'),
      searchPlaceholder: t(
        'manage.resources.knowledgeGraphViewer.searchPlaceholder'
      ),
      searching: t('manage.resources.knowledgeGraphViewer.searching'),
      search: t('manage.resources.knowledgeGraphViewer.search'),
      truncatedNotice: t(
        'manage.resources.knowledgeGraphViewer.truncatedNotice'
      ),
      retry: t('manage.resources.knowledgeGraphViewer.retry'),
      canvasAriaLabel: t(
        'manage.resources.knowledgeGraphViewer.canvasAriaLabel'
      ),
      zoomInAriaLabel: t(
        'manage.resources.knowledgeGraphViewer.zoomInAriaLabel'
      ),
      zoomIn: t('manage.resources.knowledgeGraphViewer.zoomIn'),
      zoomOutAriaLabel: t(
        'manage.resources.knowledgeGraphViewer.zoomOutAriaLabel'
      ),
      zoomOut: t('manage.resources.knowledgeGraphViewer.zoomOut'),
      fitView: t('manage.resources.knowledgeGraphViewer.fitView'),
      resetLayout: t('manage.resources.knowledgeGraphViewer.resetLayout'),
      legendAriaLabel: t(
        'manage.resources.knowledgeGraphViewer.legendAriaLabel'
      ),
      conceptTypes: t('manage.resources.knowledgeGraphViewer.conceptTypes'),
      shapeCircle: t('manage.resources.knowledgeGraphViewer.shapeCircle'),
      shapeDiamond: t('manage.resources.knowledgeGraphViewer.shapeDiamond'),
      shapeRoundedSquare: t(
        'manage.resources.knowledgeGraphViewer.shapeRoundedSquare'
      ),
      shapeHexagon: t('manage.resources.knowledgeGraphViewer.shapeHexagon'),
      loading: t('manage.resources.knowledgeGraphViewer.loading'),
      unavailableTitle: t(
        'manage.resources.knowledgeGraphViewer.unavailableTitle'
      ),
      notReadyTitle: t('manage.resources.knowledgeGraphViewer.notReadyTitle'),
      checkAgain: t('manage.resources.knowledgeGraphViewer.checkAgain'),
      searchResults: t('manage.resources.knowledgeGraphViewer.searchResults'),
      loadedConcepts: (count) =>
        t('manage.resources.knowledgeGraphViewer.loadedConcepts', { count }),
      noConceptsLoaded: t(
        'manage.resources.knowledgeGraphViewer.noConceptsLoaded'
      ),
      loadedRelationships: (count) =>
        t('manage.resources.knowledgeGraphViewer.loadedRelationships', {
          count,
        }),
      noRelationshipsLoaded: t(
        'manage.resources.knowledgeGraphViewer.noRelationshipsLoaded'
      ),
      selectRelationshipAriaLabel: (source, target, label) =>
        t('manage.resources.knowledgeGraphViewer.selectRelationshipAriaLabel', {
          source,
          target,
          label,
        }),
      searchUnavailable: t(
        'manage.resources.knowledgeGraphViewer.searchUnavailable'
      ),
      connectionsUnavailable: t(
        'manage.resources.knowledgeGraphViewer.connectionsUnavailable'
      ),
      graphUnavailable: t(
        'manage.resources.knowledgeGraphViewer.graphUnavailable'
      ),
      searchResultsLoadedAnnouncement: (count) =>
        t(
          'manage.resources.knowledgeGraphViewer.searchResultsLoadedAnnouncement',
          { count }
        ),
      conceptsLoadedAnnouncement: (count) =>
        t('manage.resources.knowledgeGraphViewer.conceptsLoadedAnnouncement', {
          count,
        }),
      selectedConceptAnnouncement: (label) =>
        t('manage.resources.knowledgeGraphViewer.selectedConceptAnnouncement', {
          label,
        }),
      selectedRelationshipAnnouncement: t(
        'manage.resources.knowledgeGraphViewer.selectedRelationshipAnnouncement'
      ),
      detailsClosedAnnouncement: t(
        'manage.resources.knowledgeGraphViewer.detailsClosedAnnouncement'
      ),
      defaultUnavailableMessage: t(
        'manage.resources.knowledgeGraphPreviewUnavailable'
      ),
      details: {
        detailsFallback: t(
          'manage.resources.knowledgeGraphViewer.details.detailsFallback'
        ),
        ariaLabel: t('manage.resources.knowledgeGraphViewer.details.ariaLabel'),
        relationship: t(
          'manage.resources.knowledgeGraphViewer.details.relationship'
        ),
        concept: t('manage.resources.knowledgeGraphViewer.details.concept'),
        closeAriaLabel: t(
          'manage.resources.knowledgeGraphViewer.details.closeAriaLabel'
        ),
        type: t('manage.resources.knowledgeGraphViewer.details.type'),
        connections: t(
          'manage.resources.knowledgeGraphViewer.details.connections'
        ),
        summary: t('manage.resources.knowledgeGraphViewer.details.summary'),
        content: t('manage.resources.knowledgeGraphViewer.details.content'),
        sources: t('manage.resources.knowledgeGraphViewer.details.sources'),
        loadingConnections: t(
          'manage.resources.knowledgeGraphViewer.details.loadingConnections'
        ),
        expandConnections: t(
          'manage.resources.knowledgeGraphViewer.details.expandConnections'
        ),
        from: t('manage.resources.knowledgeGraphViewer.details.from'),
        to: t('manage.resources.knowledgeGraphViewer.details.to'),
        properties: t(
          'manage.resources.knowledgeGraphViewer.details.properties'
        ),
      },
    }),
    [t]
  )

  const dataSource = useMemo<KnowledgeGraphDataSource>(() => {
    const validateRevision = (response: GraphResponse) => {
      if (response.builtRevision !== builtRevision) {
        throw new KnowledgeGraphUnavailableError()
      }
      return toKnowledgeGraphResponse(response)
    }

    return {
      overview: async () => {
        try {
          const { data } = await apolloClient.query({
            query: GetChatbotKnowledgeGraphOverviewDocument,
            variables: { chatbotId },
            fetchPolicy: 'network-only',
          })
          return validateRevision(data.getChatbotKnowledgeGraphOverview)
        } catch (error) {
          return normalizePreviewError(error)
        }
      },
      search: async (query) => {
        try {
          const { data } = await apolloClient.query({
            query: SearchChatbotKnowledgeGraphDocument,
            variables: { chatbotId, query },
            fetchPolicy: 'network-only',
          })
          return validateRevision(data.searchChatbotKnowledgeGraph)
        } catch (error) {
          return normalizePreviewError(error)
        }
      },
      neighbors: async (nodeId) => {
        try {
          const { data } = await apolloClient.query({
            query: GetChatbotKnowledgeGraphNeighborsDocument,
            variables: { chatbotId, nodeId },
            fetchPolicy: 'network-only',
          })
          return validateRevision(data.getChatbotKnowledgeGraphNeighbors)
        } catch (error) {
          return normalizePreviewError(error)
        }
      },
    }
  }, [apolloClient, builtRevision, chatbotId])

  return (
    <div data-cy="chatbot-knowledge-graph-preview">
      <KnowledgeGraphViewer
        dataSource={dataSource}
        labels={labels}
        unavailableMessage={t(
          'manage.resources.knowledgeGraphPreviewUnavailable'
        )}
        className="!h-[42rem]"
      />
    </div>
  )
}

export default ChatbotKnowledgeGraphPreview
