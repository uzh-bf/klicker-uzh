import { Boxes, FileText, Network, Settings } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { AddResourceDialog } from './components/AddResourceDialog.js'
import { KnowledgeBaseSettingsView } from './components/KnowledgeBaseSettingsView.js'
import { KnowledgeBaseSidebar } from './components/KnowledgeBaseSidebar.js'
import { KnowledgeGraphView } from './components/KnowledgeGraphView.js'
import { MetricsHeader } from './components/MetricsHeader.js'
import { ResourceFilters } from './components/ResourceFilters.js'
import { ResourceInspector } from './components/ResourceInspector.js'
import { ResourceTable } from './components/ResourceTable.js'
import type {
  KnowledgeBaseManagerProps,
  KnowledgeManagerView,
  KnowledgeResourceFilterState,
  KnowledgeResourceType,
} from './types.js'
import { DEFAULT_RESOURCE_TYPES, filterKnowledgeResources } from './utils.js'

const DEFAULT_FILTER_STATE: KnowledgeResourceFilterState = {
  query: '',
  type: 'all',
}

export function KnowledgeBaseManager({
  knowledgeBases,
  resources,
  resourceTypes,
  metadataSchemas,
  graphData,
  settingsData,
  activeView,
  selectedKnowledgeBaseId,
  selectedResourceId,
  filterState,
  isLoading = false,
  errorMessage,
  emptyState,
  className,
  onActiveViewChange,
  onFilterStateChange,
  onSelectKnowledgeBase,
  onSelectResource,
  onAddResource,
  onUploadResources,
  onAddWebsite,
  onAddSnippet,
  onAddInternalResource,
  onReindexKnowledgeBase,
  onReindexResource,
  onDeleteResources,
  onOpenSettings,
  onUpdateKnowledgeBaseRefreshPolicy,
  onUpdateResourceRefreshPolicy,
}: KnowledgeBaseManagerProps) {
  const [internalKnowledgeBaseId, setInternalKnowledgeBaseId] = useState(
    knowledgeBases[0]?.id
  )
  const [internalResourceId, setInternalResourceId] = useState(resources[0]?.id)
  const [internalFilterState, setInternalFilterState] =
    useState<KnowledgeResourceFilterState>(DEFAULT_FILTER_STATE)
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogDefaultType, setDialogDefaultType] =
    useState<KnowledgeResourceType>('document')
  const [internalActiveView, setInternalActiveView] =
    useState<KnowledgeManagerView>('resources')

  const activeKnowledgeBaseId =
    selectedKnowledgeBaseId ?? internalKnowledgeBaseId ?? knowledgeBases[0]?.id
  const currentView = activeView ?? internalActiveView
  const activeFilterState = filterState ?? internalFilterState

  const selectedKnowledgeBase = useMemo(
    () =>
      knowledgeBases.find(
        (knowledgeBase) => knowledgeBase.id === activeKnowledgeBaseId
      ),
    [activeKnowledgeBaseId, knowledgeBases]
  )

  const effectiveKnowledgeBaseMetadataSchema =
    selectedKnowledgeBase?.metadataSchema ??
    metadataSchemas?.knowledgeBase ??
    []
  const effectiveResourceMetadataSchema =
    selectedKnowledgeBase?.resourceMetadataSchema ??
    metadataSchemas?.resource ??
    []
  const effectiveResourceTypes =
    selectedKnowledgeBase?.resourceTypes ??
    resourceTypes ??
    DEFAULT_RESOURCE_TYPES
  const effectiveRefreshPolicy = selectedKnowledgeBase?.refreshPolicy

  const scopedResources = useMemo(
    () =>
      resources.filter(
        (resource) =>
          !activeKnowledgeBaseId ||
          !resource.knowledgeBaseId ||
          resource.knowledgeBaseId === activeKnowledgeBaseId
      ),
    [activeKnowledgeBaseId, resources]
  )

  const filteredResources = useMemo(
    () =>
      filterKnowledgeResources(
        scopedResources,
        activeFilterState.query,
        activeFilterState.type,
        effectiveResourceMetadataSchema,
        activeFilterState.metadata,
        activeFilterState.status ?? 'all'
      ),
    [
      activeFilterState.metadata,
      activeFilterState.query,
      activeFilterState.status,
      activeFilterState.type,
      effectiveResourceMetadataSchema,
      scopedResources,
    ]
  )

  const activeResourceId =
    selectedResourceId ?? internalResourceId ?? filteredResources[0]?.id

  const selectedResource = useMemo(
    () =>
      filteredResources.find((resource) => resource.id === activeResourceId) ??
      filteredResources[0],
    [activeResourceId, filteredResources]
  )

  const updateFilterState = (nextState: KnowledgeResourceFilterState) => {
    if (!filterState) {
      setInternalFilterState(nextState)
    }

    onFilterStateChange?.(nextState)
  }

  const selectKnowledgeBase = (knowledgeBaseId: string) => {
    setInternalKnowledgeBaseId(knowledgeBaseId)
    setSelectedResourceIds([])
    onSelectKnowledgeBase?.(knowledgeBaseId)
  }

  const selectResource = (resourceId: string) => {
    setInternalResourceId(resourceId)
    onSelectResource?.(resourceId)
  }

  const selectView = (view: KnowledgeManagerView) => {
    if (!activeView) {
      setInternalActiveView(view)
    }

    if (view === 'settings' && selectedKnowledgeBase) {
      onOpenSettings?.(selectedKnowledgeBase.id)
    }

    onActiveViewChange?.(view)
  }

  const openAddResourceDialog = (type: KnowledgeResourceType = 'document') => {
    setDialogDefaultType(type)
    setDialogOpen(true)
  }

  const toggleResourceSelection = (resourceId: string) => {
    setSelectedResourceIds((current) =>
      current.includes(resourceId)
        ? current.filter((id) => id !== resourceId)
        : [...current, resourceId]
    )
  }

  const deleteSelectedResources = () => {
    onDeleteResources?.(selectedResourceIds)
    setSelectedResourceIds([])
  }

  if (isLoading) {
    return (
      <div
        className={twMerge(
          'flex min-h-[520px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-600',
          className?.root
        )}
      >
        Loading knowledge bases...
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div
        className={twMerge(
          'flex min-h-[520px] items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8 text-center',
          className?.root
        )}
      >
        <div>
          <div className="font-bold text-red-900">
            Knowledge bases could not be loaded.
          </div>
          <div className="mt-2 text-sm text-red-700">{errorMessage}</div>
        </div>
      </div>
    )
  }

  if (knowledgeBases.length === 0) {
    return (
      <div
        className={twMerge(
          'flex min-h-[520px] items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-center',
          className?.root
        )}
      >
        {emptyState ?? (
          <div>
            <Boxes className="text-primary-100 mx-auto size-9" />
            <div className="mt-3 font-bold text-slate-950">
              No knowledge bases yet
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'grid h-full min-h-[720px] min-w-0 overflow-auto rounded-lg border border-slate-200 bg-white text-slate-950 shadow-sm lg:grid-cols-[240px_minmax(0,1fr)] lg:overflow-hidden',
        currentView === 'resources' &&
          'xl:grid-cols-[240px_minmax(0,1fr)_306px]',
        className?.root
      )}
      style={
        {
          '--kb-accent': '#0028a5',
          '--kb-ready': '#4f7419',
          '--kb-indexing': '#123ab5',
          '--kb-warning': '#8a6500',
          '--kb-error': '#b6451c',
        } as CSSProperties
      }
    >
      <KnowledgeBaseSidebar
        knowledgeBases={knowledgeBases}
        selectedKnowledgeBaseId={selectedKnowledgeBase?.id}
        metadataSchema={metadataSchemas?.knowledgeBase}
        className={className?.sidebar}
        onSelectKnowledgeBase={selectKnowledgeBase}
      />

      <main
        className={twMerge('flex min-h-0 min-w-0 flex-col', className?.main)}
      >
        <MetricsHeader
          knowledgeBase={selectedKnowledgeBase}
          metadataSchema={effectiveKnowledgeBaseMetadataSchema}
          onAddResource={() => openAddResourceDialog()}
          onOpenSettings={() => selectView('settings')}
          onReindex={() =>
            selectedKnowledgeBase &&
            onReindexKnowledgeBase?.(selectedKnowledgeBase.id)
          }
        />

        <nav
          className="flex h-11 shrink-0 items-end gap-5 overflow-x-auto border-b border-slate-200 bg-white px-5 text-sm font-semibold text-slate-500"
          aria-label="Knowledge base sections"
        >
          <TabButton
            active={currentView === 'resources'}
            icon={<FileText className="size-4" />}
            label="Resources"
            onClick={() => selectView('resources')}
          />
          <TabButton
            active={currentView === 'graph'}
            icon={<Network className="size-4" />}
            label="Knowledge graph"
            onClick={() => selectView('graph')}
          />
          <TabButton
            active={currentView === 'settings'}
            icon={<Settings className="size-4" />}
            label="Settings"
            onClick={() => selectView('settings')}
          />
        </nav>

        {currentView === 'resources' && (
          <>
            <ResourceFilters
              filterState={activeFilterState}
              onChange={updateFilterState}
              onAddResource={() => openAddResourceDialog()}
              onUpload={() => openAddResourceDialog('document')}
            />

            <ResourceTable
              resources={filteredResources}
              selectedResourceId={selectedResource?.id}
              selectedResourceIds={selectedResourceIds}
              metadataSchema={effectiveResourceMetadataSchema}
              resourceTypes={effectiveResourceTypes}
              filterState={activeFilterState}
              knowledgeBaseRefreshPolicy={effectiveRefreshPolicy}
              className={className?.table}
              onFilterStateChange={updateFilterState}
              onSelectResource={selectResource}
              onToggleResourceSelection={toggleResourceSelection}
              onDeleteSelected={deleteSelectedResources}
            />
          </>
        )}

        {currentView === 'graph' && (
          <KnowledgeGraphView
            graphData={graphData}
            metadataSchema={effectiveResourceMetadataSchema}
            resourceTypes={effectiveResourceTypes}
          />
        )}

        {currentView === 'settings' && (
          <KnowledgeBaseSettingsView
            knowledgeBase={selectedKnowledgeBase}
            settingsData={settingsData}
            metadataSchema={effectiveKnowledgeBaseMetadataSchema}
            resourceMetadataSchema={effectiveResourceMetadataSchema}
            onUpdateKnowledgeBaseRefreshPolicy={
              onUpdateKnowledgeBaseRefreshPolicy
            }
          />
        )}
      </main>

      {currentView === 'resources' && (
        <ResourceInspector
          resource={selectedResource}
          metadataSchema={effectiveResourceMetadataSchema}
          resourceTypes={effectiveResourceTypes}
          knowledgeBaseRefreshPolicy={effectiveRefreshPolicy}
          className={twMerge('hidden xl:flex', className?.inspector)}
          onReindexResource={onReindexResource}
          onUpdateResourceRefreshPolicy={onUpdateResourceRefreshPolicy}
        />
      )}

      <AddResourceDialog
        open={dialogOpen}
        defaultType={dialogDefaultType}
        onClose={() => setDialogOpen(false)}
        onAddResource={onAddResource}
        onUploadResources={onUploadResources}
        onAddWebsite={onAddWebsite}
        onAddSnippet={onAddSnippet}
        onAddInternalResource={onAddInternalResource}
      />
    </div>
  )
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={twMerge(
        'flex h-11 shrink-0 items-center gap-2 border-b-2 border-transparent hover:text-slate-800',
        active && 'border-primary-100 text-primary-100'
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  )
}
