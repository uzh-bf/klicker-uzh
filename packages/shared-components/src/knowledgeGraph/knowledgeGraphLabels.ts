export type KnowledgeGraphDetailsLabels = {
  detailsFallback: string
  ariaLabel: string
  relationship: string
  concept: string
  closeAriaLabel: string
  type: string
  connections: string
  summary: string
  content: string
  sources: string
  loadingConnections: string
  expandConnections: string
  from: string
  to: string
  properties: string
}

export type KnowledgeGraphViewerLabels = {
  explorerAriaLabel: string
  searchAriaLabel: string
  searchLabel: string
  searchPlaceholder: string
  searching: string
  search: string
  truncatedNotice: string
  retry: string
  canvasAriaLabel: string
  zoomInAriaLabel: string
  zoomIn: string
  zoomOutAriaLabel: string
  zoomOut: string
  fitView: string
  resetLayout: string
  legendAriaLabel: string
  conceptTypes: string
  shapeCircle: string
  shapeDiamond: string
  shapeRoundedSquare: string
  shapeHexagon: string
  loading: string
  unavailableTitle: string
  notReadyTitle: string
  checkAgain: string
  searchResults: string
  loadedConcepts: (count: number) => string
  noConceptsLoaded: string
  loadedRelationships: (count: number) => string
  noRelationshipsLoaded: string
  selectRelationshipAriaLabel: (
    source: string,
    target: string,
    label: string
  ) => string
  searchUnavailable: string
  connectionsUnavailable: string
  graphUnavailable: string
  searchResultsLoadedAnnouncement: (count: number) => string
  conceptsLoadedAnnouncement: (count: number) => string
  selectedConceptAnnouncement: (label: string) => string
  selectedRelationshipAnnouncement: string
  detailsClosedAnnouncement: string
  defaultUnavailableMessage: string
  details: KnowledgeGraphDetailsLabels
}

export type KnowledgeGraphViewerLabelOverrides = Partial<
  Omit<KnowledgeGraphViewerLabels, 'details'>
> & {
  details?: Partial<KnowledgeGraphDetailsLabels>
}

export const DEFAULT_KNOWLEDGE_GRAPH_LABELS: KnowledgeGraphViewerLabels = {
  explorerAriaLabel: 'Knowledge graph explorer',
  searchAriaLabel: 'Search the knowledge graph',
  searchLabel: 'Search concepts',
  searchPlaceholder: 'Search concepts…',
  searching: 'Searching…',
  search: 'Search',
  truncatedNotice:
    'This bounded view shows the most connected concepts. Search to explore the complete graph.',
  retry: 'Retry',
  canvasAriaLabel:
    'Interactive knowledge graph. Use the concept and relationship lists below for keyboard navigation.',
  zoomInAriaLabel: 'Zoom in on the knowledge graph',
  zoomIn: 'Zoom in',
  zoomOutAriaLabel: 'Zoom out of the knowledge graph',
  zoomOut: 'Zoom out',
  fitView: 'Fit view',
  resetLayout: 'Reset layout',
  legendAriaLabel: 'Concept type legend',
  conceptTypes: 'Concept types',
  shapeCircle: 'circle',
  shapeDiamond: 'diamond',
  shapeRoundedSquare: 'rounded square',
  shapeHexagon: 'hexagon',
  loading: 'Loading knowledge graph…',
  unavailableTitle: 'Knowledge graph unavailable',
  notReadyTitle: 'Knowledge graph not ready',
  checkAgain: 'Check again',
  searchResults: 'Search results',
  loadedConcepts: (count) => `Loaded concepts (${count})`,
  noConceptsLoaded: 'No concepts loaded.',
  loadedRelationships: (count) => `Loaded relationships (${count})`,
  noRelationshipsLoaded: 'No relationships loaded.',
  selectRelationshipAriaLabel: (source, target, label) =>
    `Select relationship ${source} to ${target}: ${label}`,
  searchUnavailable: 'Search is temporarily unavailable. Try again.',
  connectionsUnavailable: 'Connections are temporarily unavailable. Try again.',
  graphUnavailable: 'The knowledge graph is temporarily unavailable.',
  searchResultsLoadedAnnouncement: (count) => `${count} search results loaded.`,
  conceptsLoadedAnnouncement: (count) => `${count} concepts loaded.`,
  selectedConceptAnnouncement: (label) => `Selected ${label}.`,
  selectedRelationshipAnnouncement: 'Selected relationship.',
  detailsClosedAnnouncement: 'Details closed.',
  defaultUnavailableMessage:
    'The knowledge graph is not available for the current resource selection.',
  details: {
    detailsFallback: 'Details',
    ariaLabel: 'Knowledge graph details',
    relationship: 'Relationship',
    concept: 'Concept',
    closeAriaLabel: 'Close details',
    type: 'Type',
    connections: 'Connections',
    summary: 'Summary',
    content: 'Content',
    sources: 'Sources',
    loadingConnections: 'Loading connections…',
    expandConnections: 'Expand connections',
    from: 'From',
    to: 'To',
    properties: 'Properties',
  },
}

export function resolveKnowledgeGraphLabels(
  overrides?: KnowledgeGraphViewerLabelOverrides
): KnowledgeGraphViewerLabels {
  if (overrides === undefined) {
    return DEFAULT_KNOWLEDGE_GRAPH_LABELS
  }

  return {
    ...DEFAULT_KNOWLEDGE_GRAPH_LABELS,
    ...overrides,
    details: {
      ...DEFAULT_KNOWLEDGE_GRAPH_LABELS.details,
      ...overrides.details,
    },
  }
}
