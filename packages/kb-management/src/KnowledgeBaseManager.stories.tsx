import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState } from 'react'
import { KnowledgeBaseManager } from './KnowledgeBaseManager.js'
import {
  demoAiBuddyKnowledgeBases,
  demoAiBuddyResources,
  demoAiInfraKnowledgeBases,
  demoAiInfraResources,
  demoGraphData,
  demoKnowledgeBases,
  demoResourceMetadataSchema,
  demoResources,
  demoSettingsData,
} from './mockData.js'
import type {
  AddInternalResourceInput,
  AddSnippetResourceInput,
  KnowledgeBaseSettingsData,
  KnowledgeBaseSummary,
  KnowledgeGraphData,
  KnowledgeRefreshPolicy,
  KnowledgeResource,
  KnowledgeResourceStatus,
  KnowledgeResourceType,
} from './types.js'

const meta = {
  title: 'KB Management/KnowledgeBaseManager',
  component: KnowledgeBaseManager,
  args: {
    knowledgeBases: demoKnowledgeBases,
    resources: demoResources,
    graphData: demoGraphData,
    settingsData: demoSettingsData,
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof KnowledgeBaseManager>

export default meta

type Story = StoryObj<typeof meta>

function nextStatusLabel(status: KnowledgeResourceStatus) {
  if (status === 'indexing') return 'Indexing'
  if (status === 'crawling') return 'Crawling'
  return undefined
}

function createResource(
  knowledgeBaseId: string,
  type: KnowledgeResourceType,
  partial: Partial<KnowledgeResource>
): KnowledgeResource {
  const id = `${type}-${Date.now()}`

  return {
    id,
    knowledgeBaseId,
    title: partial.title ?? 'Untitled resource',
    type,
    originLabel: partial.originLabel ?? 'Manual',
    originDetail: partial.originDetail,
    sizeLabel: partial.sizeLabel,
    chunkCount: partial.chunkCount ?? 0,
    updatedAtLabel: 'now',
    status: 'queued',
    statusLabel: 'Queued',
    metadata: partial.metadata ?? {
      studyLevel: ['both'],
      scope: 'course',
      usage: 'rag',
      topic: 'New resource',
    },
    documentMetadata: partial.documentMetadata,
    websiteMetadata: partial.websiteMetadata,
    snippetMetadata: partial.snippetMetadata,
    internalMetadata: partial.internalMetadata,
    freshness: partial.freshness ?? {
      lastCheckedAtLabel: 'now',
      lastIndexedAtLabel: 'queued',
      nextCheckAtLabel: 'after ingestion',
      changeStatus: 'unknown',
      refreshPolicy: { mode: 'inherit' },
    },
    chunkPreviews: partial.chunkPreviews ?? [
      {
        id: `${id}-chunk`,
        label: 'preview',
        content:
          'Newly added resources enter the queue before parsing, chunking, and embedding.',
      },
    ],
  }
}

function StatefulCatalog({
  initialKnowledgeBases = demoKnowledgeBases,
  initialResources = demoResources,
  graphData = demoGraphData,
  settingsData = demoSettingsData,
  compact = false,
}: {
  initialKnowledgeBases?: KnowledgeBaseSummary[]
  initialResources?: KnowledgeResource[]
  graphData?: KnowledgeGraphData
  settingsData?: KnowledgeBaseSettingsData
  compact?: boolean
}) {
  const [knowledgeBases, setKnowledgeBases] = useState(initialKnowledgeBases)
  const [resources, setResources] = useState(initialResources)
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState(
    initialKnowledgeBases[0]?.id
  )
  const [selectedResourceId, setSelectedResourceId] = useState(
    initialResources[0]?.id
  )

  const selectedKnowledgeBase = useMemo(
    () =>
      knowledgeBases.find(
        (knowledgeBase) => knowledgeBase.id === selectedKnowledgeBaseId
      ),
    [knowledgeBases, selectedKnowledgeBaseId]
  )

  const addResource = (resource: KnowledgeResource) => {
    setResources((current) => [resource, ...current])
    setSelectedResourceId(resource.id)
    setKnowledgeBases((current) =>
      current.map((knowledgeBase) =>
        knowledgeBase.id === resource.knowledgeBaseId
          ? {
              ...knowledgeBase,
              resourceCount: knowledgeBase.resourceCount + 1,
              status: 'indexing',
              statusLabel: 'Indexing',
            }
          : knowledgeBase
      )
    )
  }

  const activeKnowledgeBaseId =
    selectedKnowledgeBase?.id ?? initialKnowledgeBases[0]?.id ?? 'demo'

  const updateKnowledgeBaseRefreshPolicy = (
    knowledgeBaseId: string,
    policy: KnowledgeRefreshPolicy
  ) => {
    setKnowledgeBases((current) =>
      current.map((knowledgeBase) =>
        knowledgeBase.id === knowledgeBaseId
          ? { ...knowledgeBase, refreshPolicy: policy }
          : knowledgeBase
      )
    )
  }

  const updateResourceRefreshPolicy = (
    resourceId: string,
    policy: KnowledgeRefreshPolicy
  ) => {
    setResources((current) =>
      current.map((resource) =>
        resource.id === resourceId
          ? {
              ...resource,
              freshness: {
                ...resource.freshness,
                refreshPolicy: policy,
                nextCheckAtLabel:
                  policy.mode === 'disabled'
                    ? 'disabled'
                    : (policy.intervalLabel ?? 'manual'),
              },
            }
          : resource
      )
    )
  }

  return (
    <div
      className={
        compact
          ? 'h-[860px] max-w-[430px] bg-slate-100 p-2'
          : 'h-screen bg-slate-100 p-3'
      }
    >
      <KnowledgeBaseManager
        knowledgeBases={knowledgeBases}
        resources={resources}
        graphData={graphData}
        settingsData={settingsData}
        selectedKnowledgeBaseId={selectedKnowledgeBaseId}
        selectedResourceId={selectedResourceId}
        metadataSchemas={{ resource: demoResourceMetadataSchema }}
        className={{ root: 'h-full' }}
        onSelectKnowledgeBase={(knowledgeBaseId) => {
          setSelectedKnowledgeBaseId(knowledgeBaseId)
          setSelectedResourceId(
            resources.find(
              (resource) => resource.knowledgeBaseId === knowledgeBaseId
            )?.id
          )
        }}
        onSelectResource={setSelectedResourceId}
        onUploadResources={(files) => {
          const file = files[0]
          addResource(
            createResource(activeKnowledgeBaseId, 'document', {
              title: file?.name ?? 'Uploaded resource.pdf',
              originLabel: 'Upload',
              sizeLabel: file
                ? `${Math.max(file.size / 1024, 1).toFixed(0)} KB`
                : '-',
              documentMetadata: {
                pageCount: 1,
                fileSizeLabel: file
                  ? `${Math.max(file.size / 1024, 1).toFixed(0)} KB`
                  : '-',
                mimeType: 'PDF',
              },
              freshness: {
                lastCheckedAtLabel: 'now',
                lastIndexedAtLabel: 'queued',
                refreshPolicy: { mode: 'manual' },
              },
            })
          )
        }}
        onAddWebsite={(url) =>
          addResource(
            createResource(activeKnowledgeBaseId, 'website', {
              title: url.replace(/^https?:\/\//, ''),
              originLabel: 'URL',
              originDetail: 'index only',
              websiteMetadata: {
                strategy: 'I',
                strategyLabel: 'I index only',
                sitemapFound: false,
                scrapedPageCount: 1,
              },
            })
          )
        }
        onAddSnippet={(input: AddSnippetResourceInput) =>
          addResource(
            createResource(activeKnowledgeBaseId, 'snippet', {
              title: input.title,
              originLabel: 'Pasted',
              originDetail: 'snippet',
              chunkCount: Math.max(Math.ceil(input.content.length / 500), 1),
              snippetMetadata: {
                characterCount: input.content.length,
                language: 'EN',
              },
              freshness: {
                lastCheckedAtLabel: 'manual',
                lastIndexedAtLabel: 'queued',
                refreshPolicy: { mode: 'manual' },
              },
            })
          )
        }
        onAddInternalResource={(input: AddInternalResourceInput) =>
          addResource(
            createResource(activeKnowledgeBaseId, 'internal', {
              title: input.title,
              originLabel: input.originLabel,
              internalMetadata: {
                provider: input.originLabel,
                objectType: 'Host object',
                scopeLabel: 'Course',
              },
            })
          )
        }
        onReindexKnowledgeBase={(knowledgeBaseId) => {
          setKnowledgeBases((current) =>
            current.map((knowledgeBase) =>
              knowledgeBase.id === knowledgeBaseId
                ? {
                    ...knowledgeBase,
                    status: 'indexing',
                    statusLabel: 'Indexing',
                  }
                : knowledgeBase
            )
          )
          setResources((current) =>
            current.map((resource) =>
              resource.knowledgeBaseId === knowledgeBaseId
                ? {
                    ...resource,
                    status: 'indexing',
                    statusLabel: nextStatusLabel('indexing'),
                    progress: Math.max(resource.progress ?? 0, 18),
                  }
                : resource
            )
          )
        }}
        onReindexResource={(resourceId) =>
          setResources((current) =>
            current.map((resource) =>
              resource.id === resourceId
                ? {
                    ...resource,
                    status: 'indexing',
                    statusLabel: 'Indexing',
                    progress: 42,
                    freshness: {
                      ...resource.freshness,
                      lastCheckedAtLabel: 'now',
                      lastIndexedAtLabel: 'running',
                    },
                  }
                : resource
            )
          )
        }
        onDeleteResources={(resourceIds) => {
          setResources((current) =>
            current.filter((resource) => !resourceIds.includes(resource.id))
          )
          if (selectedResourceId && resourceIds.includes(selectedResourceId)) {
            setSelectedResourceId(undefined)
          }
        }}
        onUpdateKnowledgeBaseRefreshPolicy={updateKnowledgeBaseRefreshPolicy}
        onUpdateResourceRefreshPolicy={updateResourceRefreshPolicy}
      />
    </div>
  )
}

export const WineChemistry: Story = {
  args: {
    knowledgeBases: demoKnowledgeBases,
    resources: demoResources,
    graphData: demoGraphData,
    settingsData: demoSettingsData,
  },
  render: () => <StatefulCatalog />,
}

export const MobileLayout: Story = {
  args: {
    knowledgeBases: demoKnowledgeBases,
    resources: demoResources,
    graphData: demoGraphData,
    settingsData: demoSettingsData,
  },
  render: () => <StatefulCatalog compact />,
}

export const AiBuddyCatalog: Story = {
  args: {
    knowledgeBases: demoAiBuddyKnowledgeBases,
    resources: demoAiBuddyResources,
    settingsData: demoSettingsData,
  },
  render: () => (
    <StatefulCatalog
      initialKnowledgeBases={demoAiBuddyKnowledgeBases}
      initialResources={demoAiBuddyResources}
      graphData={undefined}
      settingsData={demoSettingsData}
    />
  ),
}

export const AiInfraCatalog: Story = {
  args: {
    knowledgeBases: demoAiInfraKnowledgeBases,
    resources: demoAiInfraResources,
    settingsData: demoSettingsData,
  },
  render: () => (
    <StatefulCatalog
      initialKnowledgeBases={demoAiInfraKnowledgeBases}
      initialResources={demoAiInfraResources}
      graphData={undefined}
      settingsData={demoSettingsData}
    />
  ),
}

export const Loading: Story = {
  args: {
    knowledgeBases: [],
    resources: [],
    isLoading: true,
  },
  decorators: [
    (StoryComponent) => (
      <div className="h-screen bg-slate-100 p-3">
        <StoryComponent />
      </div>
    ),
  ],
}

export const ErrorState: Story = {
  args: {
    knowledgeBases: [],
    resources: [],
    errorMessage: 'The catalog service returned a temporary 503.',
  },
  decorators: [
    (StoryComponent) => (
      <div className="h-screen bg-slate-100 p-3">
        <StoryComponent />
      </div>
    ),
  ],
}

export const EmptyState: Story = {
  args: {
    knowledgeBases: [],
    resources: [],
  },
  decorators: [
    (StoryComponent) => (
      <div className="h-screen bg-slate-100 p-3">
        <StoryComponent />
      </div>
    ),
  ],
}
