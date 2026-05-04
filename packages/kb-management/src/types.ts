import type { ReactNode } from 'react'

export type KnowledgeResourceType = string

export type KnowledgeResourceStatus =
  | 'ready'
  | 'indexing'
  | 'crawling'
  | 'queued'
  | 'stale'
  | 'error'
  | 'disabled'

export type KnowledgeManagerView = 'resources' | 'graph' | 'settings'

export type KnowledgeResourceIcon =
  | 'document'
  | 'website'
  | 'snippet'
  | 'internal'
  | 'dataset'
  | 'quiz'
  | 'default'

export interface KnowledgeResourceTypeDefinition {
  id: KnowledgeResourceType
  label: string
  shortLabel?: string
  description?: string
  icon?: KnowledgeResourceIcon
  colorClassName?: string
}

export type KnowledgeMetadataFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'multiEnum'
  | 'date'
  | 'url'

export type KnowledgeMetadataVisibility =
  | 'sidebar'
  | 'header'
  | 'table'
  | 'popover'
  | 'settings'
  | 'hidden'

export type KnowledgeMetadataValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | null
  | undefined

export interface KnowledgeMetadataOption {
  id: string
  label: string
  colorClassName?: string
}

export interface KnowledgeMetadataFieldDefinition {
  id: string
  label: string
  type: KnowledgeMetadataFieldType
  description?: string
  options?: KnowledgeMetadataOption[]
  retrievalKey?: boolean
  required?: boolean
  recommended?: boolean
  filterable?: boolean
  editable?: boolean
  displayPriority?: number
  visibility?: KnowledgeMetadataVisibility[]
}

export interface KnowledgeBaseMetric {
  id: string
  label: string
  value: string | number
  hint?: string
}

export type KnowledgeRefreshMode =
  | 'inherit'
  | 'manual'
  | 'interval'
  | 'cron'
  | 'disabled'

export type KnowledgeRefreshScope = 'all' | 'websites' | 'refreshable'

export interface KnowledgeRefreshPolicy {
  mode: KnowledgeRefreshMode
  label?: string
  intervalLabel?: string
  intervalMinutes?: number | null
  cronLabel?: string
  scope?: KnowledgeRefreshScope
  changeMonitoring?: boolean
}

export type KnowledgeChangeStatus =
  | 'unchanged'
  | 'changed'
  | 'stale'
  | 'unknown'
  | 'error'

export interface KnowledgeResourceFreshness {
  lastIndexedAtLabel?: string
  lastCheckedAtLabel?: string
  lastRemoteModifiedAtLabel?: string
  lastContentChangedAtLabel?: string
  nextCheckAtLabel?: string
  changeStatus?: KnowledgeChangeStatus
  changeStatusLabel?: string
  refreshPolicy?: KnowledgeRefreshPolicy
  inheritedFromKnowledgeBase?: boolean
}

export interface KnowledgeBaseSummary {
  id: string
  name: string
  description?: string
  resourceCount: number
  status: KnowledgeResourceStatus
  statusLabel?: string
  metrics?: KnowledgeBaseMetric[]
  updatedAtLabel?: string
  metadataSchema?: KnowledgeMetadataFieldDefinition[]
  metadata?: Record<string, KnowledgeMetadataValue>
  resourceMetadataSchema?: KnowledgeMetadataFieldDefinition[]
  resourceTypes?: KnowledgeResourceTypeDefinition[]
  refreshPolicy?: KnowledgeRefreshPolicy
}

export interface KnowledgeChunkPreview {
  id: string
  label?: string
  pageLabel?: string
  content: string
}

export interface LinkedConsumer {
  id: string
  name: string
  description?: string
  avatarLabel?: string
  href?: string
}

export interface ReindexSchedule {
  id: string
  label: string
  nextRunLabel?: string
  note?: string
}

export interface IngestionRunSummary {
  id: string
  label: string
  status: KnowledgeResourceStatus
  value?: number
}

export interface DocumentResourceMetadata {
  pageCount?: number
  fileSizeLabel?: string
  mimeType?: string
  language?: string
  extractedTitle?: string
  author?: string
}

export type WebsiteResourceStrategy = 'S' | 'I' | 'K'

export interface WebsiteSubsiteSummary {
  id: string
  title: string
  url: string
  status?: KnowledgeResourceStatus
  chunkCount?: number
  lastCheckedAtLabel?: string
  lastChangedAtLabel?: string
}

export interface WebsiteResourceMetadata {
  strategy: WebsiteResourceStrategy
  strategyLabel?: string
  sitemapFound?: boolean
  sitemapPageCount?: number
  scrapedPageCount?: number
  depthLabel?: string
  subsites?: WebsiteSubsiteSummary[]
}

export interface SnippetResourceMetadata {
  characterCount?: number
  language?: string
  author?: string
  note?: string
}

export interface InternalResourceMetadata {
  provider?: string
  objectType?: string
  courseLabel?: string
  scopeLabel?: string
  itemCount?: number
}

export interface KnowledgeResource {
  id: string
  knowledgeBaseId?: string
  title: string
  type: KnowledgeResourceType
  originLabel: string
  originDetail?: string
  sizeLabel?: string
  chunkCount?: number
  updatedAtLabel?: string
  status: KnowledgeResourceStatus
  statusLabel?: string
  statusMessage?: string
  progress?: number
  metadata?: Record<string, KnowledgeMetadataValue>
  documentMetadata?: DocumentResourceMetadata
  websiteMetadata?: WebsiteResourceMetadata
  snippetMetadata?: SnippetResourceMetadata
  internalMetadata?: InternalResourceMetadata
  freshness?: KnowledgeResourceFreshness
  chunkPreviews?: KnowledgeChunkPreview[]
  linkedConsumers?: LinkedConsumer[]
  reindexSchedule?: ReindexSchedule
  ingestionRuns?: IngestionRunSummary[]
}

export interface KnowledgeResourceFilterState {
  query: string
  type: KnowledgeResourceType | 'all'
  status?: KnowledgeResourceStatus | 'all'
  metadata?: Record<string, string[]>
}

export interface KnowledgeGraphNode {
  id: string
  label: string
  type: KnowledgeResourceType
  x?: number
  y?: number
  size?: number
  metadata?: Record<string, KnowledgeMetadataValue>
  chunkPreviews?: KnowledgeChunkPreview[]
}

export interface KnowledgeGraphEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  extractedByLabel?: string
}

export interface KnowledgeModelOption {
  id: string
  name: string
  description?: string
  costLabel?: string
  active?: boolean
}

export interface KnowledgeCostSummary {
  currentSpendLabel: string
  budgetLabel?: string
  usageLabel?: string
  categories?: {
    id: string
    label: string
    valueLabel: string
    colorClassName?: string
  }[]
}

export interface KnowledgeBaseSettingsData {
  generationModels?: KnowledgeModelOption[]
  embeddingModels?: KnowledgeModelOption[]
  retrievalSettings?: { id: string; label: string; value: string }[]
  costSummary?: KnowledgeCostSummary
  indexingSchedule?: ReindexSchedule
}

export interface KnowledgeBaseManagerClassName {
  root?: string
  sidebar?: string
  main?: string
  inspector?: string
  table?: string
}

export interface AddSnippetResourceInput {
  title: string
  content: string
}

export interface AddInternalResourceInput {
  title: string
  originLabel: string
}

export interface KnowledgeBaseManagerProps {
  knowledgeBases: KnowledgeBaseSummary[]
  resources: KnowledgeResource[]
  resourceTypes?: KnowledgeResourceTypeDefinition[]
  metadataSchemas?: {
    knowledgeBase?: KnowledgeMetadataFieldDefinition[]
    resource?: KnowledgeMetadataFieldDefinition[]
  }
  graphData?: KnowledgeGraphData
  settingsData?: KnowledgeBaseSettingsData
  activeView?: KnowledgeManagerView
  selectedKnowledgeBaseId?: string
  selectedResourceId?: string
  filterState?: KnowledgeResourceFilterState
  isLoading?: boolean
  errorMessage?: string
  emptyState?: ReactNode
  className?: KnowledgeBaseManagerClassName
  onActiveViewChange?: (view: KnowledgeManagerView) => void
  onFilterStateChange?: (nextState: KnowledgeResourceFilterState) => void
  onSelectKnowledgeBase?: (knowledgeBaseId: string) => void
  onSelectResource?: (resourceId: string) => void
  onAddResource?: (type: KnowledgeResourceType) => void
  onUploadResources?: (files: File[]) => void
  onAddWebsite?: (url: string) => void
  onAddSnippet?: (input: AddSnippetResourceInput) => void
  onAddInternalResource?: (input: AddInternalResourceInput) => void
  onReindexKnowledgeBase?: (knowledgeBaseId: string) => void
  onReindexResource?: (resourceId: string) => void
  onDeleteResources?: (resourceIds: string[]) => void
  onOpenSettings?: (knowledgeBaseId: string) => void
  onUpdateKnowledgeBaseRefreshPolicy?: (
    knowledgeBaseId: string,
    policy: KnowledgeRefreshPolicy
  ) => void
  onUpdateResourceRefreshPolicy?: (
    resourceId: string,
    policy: KnowledgeRefreshPolicy
  ) => void
}
