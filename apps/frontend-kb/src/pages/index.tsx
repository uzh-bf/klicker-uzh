import { useMutation, useQuery } from '@apollo/client'
import {
  CreateKbResourceDocument,
  DeleteKbResourcesDocument,
  GetKbDocument,
  GetKBsDocument,
  KbResourceKind,
  KbWebsiteStrategy,
  UpdateKbRefreshPolicyDocument,
  UpdateKbResourceRefreshPolicyDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  AddInternalResourceInput,
  AddSnippetResourceInput,
  demoGraphData,
  demoKnowledgeBaseMetadataSchema,
  demoResourceMetadataSchema,
  demoResourceTypes,
  demoSettingsData,
  KnowledgeBaseManager,
  KnowledgeManagerView,
  KnowledgeResourceFilterState,
} from '@klicker-uzh/kb-management'
import { toast } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useEffect, useMemo, useState } from 'react'
import { KbLayout } from '../components/KbLayout'
import { toKnowledgeBaseSummary, toKnowledgeResource } from '../lib/kbMapping'

const DEFAULT_FILTER_STATE: KnowledgeResourceFilterState = {
  query: '',
  type: 'all',
  status: 'all',
}

function KbHomePage() {
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<
    string | undefined
  >()
  const [selectedResourceId, setSelectedResourceId] = useState<
    string | undefined
  >()
  const [activeView, setActiveView] =
    useState<KnowledgeManagerView>('resources')
  const [filterState, setFilterState] =
    useState<KnowledgeResourceFilterState>(DEFAULT_FILTER_STATE)

  const kbListQuery = useQuery(GetKBsDocument, {
    fetchPolicy: 'cache-and-network',
  })
  const selectedKbQuery = useQuery(GetKbDocument, {
    variables: { id: selectedKnowledgeBaseId ?? '' },
    skip: !selectedKnowledgeBaseId,
    fetchPolicy: 'cache-and-network',
  })

  const [createKBResource] = useMutation(CreateKbResourceDocument)
  const [deleteKBResources] = useMutation(DeleteKbResourcesDocument)
  const [updateKBRefreshPolicy] = useMutation(UpdateKbRefreshPolicyDocument)
  const [updateKBResourceRefreshPolicy] = useMutation(
    UpdateKbResourceRefreshPolicyDocument
  )

  const knowledgeBases = useMemo(
    () => (kbListQuery.data?.getKBs ?? []).map(toKnowledgeBaseSummary),
    [kbListQuery.data?.getKBs]
  )
  const selectedKnowledgeBase = selectedKbQuery.data?.getKB
  const resources = useMemo(
    () => (selectedKnowledgeBase?.resources ?? []).map(toKnowledgeResource),
    [selectedKnowledgeBase?.resources]
  )

  useEffect(() => {
    const firstKbId = kbListQuery.data?.getKBs[0]?.id
    if (!selectedKnowledgeBaseId && firstKbId) {
      setSelectedKnowledgeBaseId(firstKbId)
    }
  }, [kbListQuery.data?.getKBs, selectedKnowledgeBaseId])

  const refetchKBs = async () => {
    await kbListQuery.refetch()
    if (selectedKnowledgeBaseId) {
      await selectedKbQuery.refetch({ id: selectedKnowledgeBaseId })
    }
  }

  const selectedKnowledgeBaseSummary =
    knowledgeBases.find((kb) => kb.id === selectedKnowledgeBaseId) ??
    knowledgeBases[0]

  const notifyNotConnected = (action: string) => {
    toast({
      type: 'warning',
      message: `${action} is not connected in this shell yet.`,
      options: { duration: 5000 },
    })
  }

  const runMutation = async (
    mutation: Promise<unknown>,
    successMessage?: string,
    afterRefetch?: () => void
  ) => {
    try {
      await mutation
      await refetchKBs()
      afterRefetch?.()
      if (successMessage) {
        toast({ type: 'success', message: successMessage })
      }
    } catch (error) {
      toast({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <KbLayout>
      <KnowledgeBaseManager
        knowledgeBases={knowledgeBases}
        resources={resources}
        resourceTypes={demoResourceTypes}
        metadataSchemas={{
          knowledgeBase: demoKnowledgeBaseMetadataSchema,
          resource: demoResourceMetadataSchema,
        }}
        graphData={demoGraphData}
        settingsData={demoSettingsData}
        activeView={activeView}
        selectedKnowledgeBaseId={selectedKnowledgeBaseSummary?.id}
        selectedResourceId={selectedResourceId}
        filterState={filterState}
        isLoading={kbListQuery.loading || selectedKbQuery.loading}
        errorMessage={
          kbListQuery.error?.message ?? selectedKbQuery.error?.message
        }
        emptyState="No knowledge bases are available yet."
        onActiveViewChange={setActiveView}
        onFilterStateChange={setFilterState}
        onSelectKnowledgeBase={(knowledgeBaseId: string) => {
          setSelectedKnowledgeBaseId(knowledgeBaseId)
          setSelectedResourceId(undefined)
        }}
        onSelectResource={setSelectedResourceId}
        onUploadResources={(files: File[]) => {
          const kbId = selectedKnowledgeBaseSummary?.id
          if (!kbId) return

          void runMutation(
            Promise.all(
              files.map((file) =>
                createKBResource({
                  variables: {
                    kbId,
                    input: {
                      title: file.name,
                      kind: KbResourceKind.Document,
                      externalResourceId: `local-upload:${file.name}:${file.lastModified}`,
                    },
                  },
                })
              )
            ),
            'Document resource queued.'
          )
        }}
        onAddWebsite={(url: string) => {
          const kbId = selectedKnowledgeBaseSummary?.id
          if (!kbId) return

          void runMutation(
            createKBResource({
              variables: {
                kbId,
                input: {
                  title: url.replace(/^https?:\/\//, ''),
                  kind: KbResourceKind.Website,
                  websiteUrl: url,
                  websiteStrategy: KbWebsiteStrategy.IndexPage,
                },
              },
            }),
            'Website resource queued.'
          )
        }}
        onAddSnippet={(input: AddSnippetResourceInput) => {
          const kbId = selectedKnowledgeBaseSummary?.id
          if (!kbId) return

          void runMutation(
            createKBResource({
              variables: {
                kbId,
                input: {
                  title: input.title,
                  kind: KbResourceKind.Snippet,
                  snippetText: input.content,
                },
              },
            }),
            'Snippet resource queued.'
          )
        }}
        onAddInternalResource={(_input: AddInternalResourceInput) =>
          notifyNotConnected('Klicker object selection')
        }
        onReindexKnowledgeBase={() =>
          notifyNotConnected('Knowledge base reindex')
        }
        onReindexResource={() => notifyNotConnected('Resource reindex')}
        onDeleteResources={(resourceIds: string[]) => {
          void runMutation(
            deleteKBResources({ variables: { resourceIds } }),
            'Resources removed.',
            () => {
              setSelectedResourceId(undefined)
            }
          )
        }}
        onOpenSettings={() => setActiveView('settings')}
        onUpdateKnowledgeBaseRefreshPolicy={(knowledgeBaseId, policy) => {
          void runMutation(
            updateKBRefreshPolicy({
              variables: {
                kbId: knowledgeBaseId,
                input: {
                  refreshIntervalMinutes: policy.intervalMinutes ?? null,
                },
              },
            })
          )
        }}
        onUpdateResourceRefreshPolicy={(resourceId, policy) => {
          void runMutation(
            updateKBResourceRefreshPolicy({
              variables: {
                resourceId,
                input: {
                  refreshIntervalMinutes: policy.intervalMinutes ?? null,
                },
              },
            })
          )
        }}
        className={{
          root: 'h-full min-h-[calc(100vh-5rem)] rounded-md',
        }}
      />
    </KbLayout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default KbHomePage
