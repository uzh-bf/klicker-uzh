'use client'

import type { KnowledgeGraphFocusRequest } from '@klicker-uzh/shared-components/src/knowledgeGraph/KnowledgeGraphViewer'
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
        <LoadingLabel />
      </div>
    ),
  }
)

function LoadingLabel() {
  const t = useTranslations('chat.graphPanel.viewer')
  return t('loading')
}

export function ChatKnowledgeGraphViewer({
  dataSource,
  onAsk,
  onQuiz,
  focusRequest,
}: {
  dataSource: KnowledgeGraphDataSource
  onAsk?: (selection: KnowledgeGraphAskSelection) => void
  onQuiz?: (selection: KnowledgeGraphAskSelection) => void
  focusRequest?: KnowledgeGraphFocusRequest
}) {
  const t = useTranslations('chat.graphPanel')
  const tv = useTranslations('chat.graphPanel.viewer')
  const td = useTranslations('chat.graphPanel.details')
  return (
    <DynamicKnowledgeGraphViewer
      dataSource={dataSource}
      onAsk={onAsk}
      onQuiz={onQuiz}
      focusRequest={focusRequest}
      labels={{
        explorerAriaLabel: tv('explorerAriaLabel'),
        searchAriaLabel: tv('searchAriaLabel'),
        searchLabel: tv('searchLabel'),
        searchPlaceholder: tv('searchPlaceholder'),
        searching: tv('searching'),
        search: tv('search'),
        truncatedNotice: tv('truncatedNotice'),
        viewLimitNotice: tv('viewLimitNotice'),
        suggestionsAriaLabel: tv('suggestionsAriaLabel'),
        noSuggestions: tv('noSuggestions'),
        suggestionsUnavailable: tv('suggestionsUnavailable'),
        backToOverview: tv('backToOverview'),
        retry: tv('retry'),
        canvasAriaLabel: tv('canvasAriaLabel'),
        zoomInAriaLabel: tv('zoomInAriaLabel'),
        zoomIn: tv('zoomIn'),
        zoomOutAriaLabel: tv('zoomOutAriaLabel'),
        zoomOut: tv('zoomOut'),
        fitView: tv('fitView'),
        resetLayout: tv('resetLayout'),
        legendAriaLabel: tv('legendAriaLabel'),
        conceptTypes: tv('conceptTypes'),
        inferredRelationLegend: t('inferredRelationLegend'),
        shapeCircle: tv('shapeCircle'),
        shapeDiamond: tv('shapeDiamond'),
        shapeRoundedSquare: tv('shapeRoundedSquare'),
        shapeHexagon: tv('shapeHexagon'),
        shapeTriangle: tv('shapeTriangle'),
        shapePentagon: tv('shapePentagon'),
        shapeStar: tv('shapeStar'),
        shapeOctagon: tv('shapeOctagon'),
        loading: tv('loading'),
        searchFirstPrompt: tv('searchFirstPrompt'),
        unavailableTitle: tv('unavailableTitle'),
        notReadyTitle: tv('notReadyTitle'),
        checkAgain: tv('checkAgain'),
        searchResults: tv('searchResults'),
        showAsList: tv('showAsList'),
        loadedConcepts: (count) => tv('loadedConcepts', { count }),
        noConceptsLoaded: tv('noConceptsLoaded'),
        loadedRelationships: (count) => tv('loadedRelationships', { count }),
        noRelationshipsLoaded: tv('noRelationshipsLoaded'),
        selectRelationshipAriaLabel: (source, target, label, symmetric) =>
          symmetric
            ? tv('selectSymmetricRelationship', { source, target, label })
            : tv('selectRelationship', { source, target, label }),
        searchUnavailable: tv('searchUnavailable'),
        connectionsUnavailable: tv('connectionsUnavailable'),
        graphUnavailable: tv('graphUnavailable'),
        searchResultsLoadedAnnouncement: (count) =>
          tv('searchResultsLoadedAnnouncement', { count }),
        conceptsLoadedAnnouncement: (count) =>
          tv('conceptsLoadedAnnouncement', { count }),
        selectedConceptAnnouncement: (label) =>
          tv('selectedConceptAnnouncement', { label }),
        selectedRelationshipAnnouncement: tv(
          'selectedRelationshipAnnouncement'
        ),
        detailsClosedAnnouncement: tv('detailsClosedAnnouncement'),
        defaultUnavailableMessage: tv('notAvailableYet'),
        details: {
          detailsFallback: td('detailsFallback'),
          ariaLabel: td('ariaLabel'),
          relationship: td('relationship'),
          concept: td('concept'),
          closeAriaLabel: td('closeAriaLabel'),
          type: td('type'),
          connections: td('connections'),
          summary: td('summary'),
          content: td('content'),
          sources: td('sources'),
          loadingConnections: td('loadingConnections'),
          expandConnections: td('expandConnections'),
          from: td('from'),
          to: td('to'),
          concepts: td('concepts'),
          evidence: td('evidence'),
          pages: (pages) =>
            td('pages', { count: pages.length, pages: pages.join(', ') }),
          properties: td('properties'),
          quiz: t('quiz'),
          allConnectionsShown: t('allConnectionsShown'),
          inferredRelation: t('inferredRelation'),
          unsourcedRelation: t('unsourcedRelation'),
          ask: t('ask'),
          missingEndpoint: t('missingEndpoint'),
          aiGeneratedNote: t('aiGeneratedNote'),
          relationTypes: {
            prerequisite_of: t('relationTypes.prerequisite_of'),
            part_of: t('relationTypes.part_of'),
            example_of: t('relationTypes.example_of'),
            applies_to: t('relationTypes.applies_to'),
            is_a: t('relationTypes.is_a'),
            has_formula: t('relationTypes.has_formula'),
            has_variable: t('relationTypes.has_variable'),
            decision_rule: t('relationTypes.decision_rule'),
            advantage_of: t('relationTypes.advantage_of'),
            disadvantage_of: t('relationTypes.disadvantage_of'),
            contrasts_with: t('relationTypes.contrasts_with'),
            synonym_of: t('relationTypes.synonym_of'),
            related: t('relationTypes.related'),
          },
          relationStatuses: {
            source: t('relationStatuses.source'),
            inferred: t('relationStatuses.inferred'),
            extracted: t('relationStatuses.extracted'),
          },
        },
      }}
      detailsLayout="contained"
      showEdgeProperties={false}
      preserveViewportOnResize
      initialView="overview"
      searchSuggestions
      overviewNavigation
      unavailableMessage={tv('notAvailableYet')}
      className="!min-h-0 flex-1"
    />
  )
}
