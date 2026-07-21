import { useMutation, useQuery } from '@apollo/client'
import {
  ChatbotKnowledgeGraphStatus,
  GetChatbotKnowledgeGraphConfigDocument,
  KbResourceStatus,
  KbResourceType,
  KbSpeedMode,
  RebuildChatbotKnowledgeGraphDocument,
  UpdateChatbotKnowledgeGraphResourcesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  kbIngestionModelIds,
  type KBIngestionModelId,
} from '@klicker-uzh/types'
import { Badge, Button, Checkbox, Select } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import ChatbotKnowledgeGraphPreview from './ChatbotKnowledgeGraphPreview'

const ACTIVE_GRAPH_STATUSES = new Set<ChatbotKnowledgeGraphStatus>([
  ChatbotKnowledgeGraphStatus.Queued,
  ChatbotKnowledgeGraphStatus.Processing,
])
const DEFAULT_KB_MODEL: KBIngestionModelId = 'klickeruzh/azure/gpt-4.1-nano'
const KB_MODEL_ITEMS = kbIngestionModelIds.map((model) => ({
  value: model,
  label: model,
}))

type SelectionState = {
  chatbotId: string
  sourceKey: string
  resourceIds: string[]
}

function selectionKey(resourceIds: readonly string[]) {
  return [...resourceIds].sort().join('\0')
}

function ChatbotKnowledgeGraphPanel({ chatbotId }: { chatbotId: string }) {
  const t = useTranslations()
  const format = useFormatter()
  const [selectionState, setSelectionState] = useState<SelectionState>({
    chatbotId: '',
    sourceKey: '',
    resourceIds: [],
  })
  const [speedMode, setSpeedMode] = useState<KbSpeedMode>(KbSpeedMode.Balanced)
  const [generationModel, setGenerationModel] =
    useState<KBIngestionModelId>(DEFAULT_KB_MODEL)
  const [cleaningModel, setCleaningModel] =
    useState<KBIngestionModelId>(DEFAULT_KB_MODEL)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [publicationSuppressed, setPublicationSuppressed] = useState(false)
  const [isSavingSelection, setIsSavingSelection] = useState(false)
  const [isRebuildingGraph, setIsRebuildingGraph] = useState(false)

  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery(
    GetChatbotKnowledgeGraphConfigDocument,
    {
      variables: { chatbotId },
      fetchPolicy: 'network-only',
      notifyOnNetworkStatusChange: true,
    }
  )
  const [updateResources] = useMutation(
    UpdateChatbotKnowledgeGraphResourcesDocument
  )
  const [rebuildGraph] = useMutation(RebuildChatbotKnowledgeGraphDocument)

  const config = data?.getChatbotKnowledgeGraphConfig
  const resourceGroups = data?.getAvailableChatbotKnowledgeGraphResources ?? []
  const populatedResourceGroups = resourceGroups.filter(
    (group) => group.resources.length > 0
  )
  const serverSelectionKey = selectionKey(config?.selectedResourceIds ?? [])
  const selectionReady =
    selectionState.chatbotId === chatbotId &&
    selectionState.sourceKey === serverSelectionKey
  const selectedResourceIds = selectionReady
    ? selectionState.resourceIds
    : (config?.selectedResourceIds ?? [])
  const selectedResourceIdSet = useMemo(
    () => new Set(selectedResourceIds),
    [selectedResourceIds]
  )
  const hasUnsavedSelection =
    selectionReady && selectionKey(selectedResourceIds) !== serverSelectionKey
  const isActive =
    config !== undefined && ACTIVE_GRAPH_STATUSES.has(config.status)
  const isPublished =
    !publicationSuppressed &&
    config?.status === ChatbotKnowledgeGraphStatus.Ready &&
    config.builtRevision !== null &&
    config.builtRevision !== undefined &&
    config.builtRevision === config.selectionRevision

  useEffect(() => {
    setSelectionState({
      chatbotId,
      sourceKey: serverSelectionKey,
      resourceIds:
        serverSelectionKey.length === 0 ? [] : serverSelectionKey.split('\0'),
    })
  }, [chatbotId, serverSelectionKey])

  useEffect(() => {
    if (isActive) {
      startPolling(60_000)
    } else {
      stopPolling()
    }

    return stopPolling
  }, [isActive, startPolling, stopPolling])

  const speedModeItems = useMemo(
    () => [
      {
        value: KbSpeedMode.Balanced,
        label: t('kb.speedModeBalanced'),
        data: { cy: 'chatbot-knowledge-graph-speed-balanced' },
      },
      {
        value: KbSpeedMode.Quality,
        label: t('kb.speedModeQuality'),
        data: { cy: 'chatbot-knowledge-graph-speed-quality' },
      },
      {
        value: KbSpeedMode.Fast,
        label: t('kb.speedModeFast'),
        data: { cy: 'chatbot-knowledge-graph-speed-fast' },
      },
    ],
    [t]
  )
  const toggleResource = (resourceId: string) => {
    if (!selectionReady || isSavingSelection) return

    setSaveSuccess(false)
    setOperationError(null)
    setSelectionState((current) => {
      const nextIds = new Set(current.resourceIds)
      if (nextIds.has(resourceId)) {
        nextIds.delete(resourceId)
      } else {
        nextIds.add(resourceId)
      }

      return { ...current, resourceIds: Array.from(nextIds).sort() }
    })
  }

  const handleSaveSelection = async () => {
    if (!hasUnsavedSelection || isSavingSelection) return

    setOperationError(null)
    setSaveSuccess(false)
    setPublicationSuppressed(true)
    setIsSavingSelection(true)
    try {
      await updateResources({
        variables: {
          chatbotId,
          resourceIds: selectedResourceIds,
        },
      })
      await refetch()
      setSaveSuccess(true)
    } catch {
      console.error('Failed to save chatbot knowledge graph resources', {
        chatbotId,
      })
      setOperationError(t('manage.resources.knowledgeGraphSelectionSaveError'))
    } finally {
      setPublicationSuppressed(false)
      setIsSavingSelection(false)
    }
  }

  const handleRebuild = async () => {
    if (
      isRebuildingGraph ||
      isSavingSelection ||
      !selectionReady ||
      isActive ||
      hasUnsavedSelection ||
      selectedResourceIds.length === 0
    ) {
      return
    }

    setOperationError(null)
    setSaveSuccess(false)
    setPublicationSuppressed(true)
    setIsRebuildingGraph(true)
    try {
      await rebuildGraph({
        variables: {
          chatbotId,
          speedMode,
          generationModel,
          cleaningModel,
        },
      })
      await refetch()
    } catch {
      console.error('Failed to rebuild chatbot knowledge graph', { chatbotId })
      setOperationError(t('manage.resources.knowledgeGraphBuildError'))
    } finally {
      setPublicationSuppressed(false)
      setIsRebuildingGraph(false)
    }
  }

  const getStatusPresentation = (status: ChatbotKnowledgeGraphStatus) => {
    switch (status) {
      case ChatbotKnowledgeGraphStatus.Empty:
        return {
          label: t('manage.resources.knowledgeGraphStatusEmpty'),
          className: 'border-uzh-grey-60 bg-uzh-grey-20 text-slate-800',
        }
      case ChatbotKnowledgeGraphStatus.Dirty:
        return {
          label: t('manage.resources.knowledgeGraphStatusDirty'),
          className: 'border-uzh-yellow-100 bg-uzh-yellow-20 text-amber-950',
        }
      case ChatbotKnowledgeGraphStatus.Queued:
        return {
          label: t('manage.resources.knowledgeGraphStatusQueued'),
          className: 'border-uzh-yellow-100 bg-uzh-yellow-20 text-amber-950',
        }
      case ChatbotKnowledgeGraphStatus.Processing:
        return {
          label: t('manage.resources.knowledgeGraphStatusProcessing'),
          className: 'border-uzh-yellow-100 bg-uzh-yellow-20 text-amber-950',
        }
      case ChatbotKnowledgeGraphStatus.Ready:
        return {
          label: t('manage.resources.knowledgeGraphStatusReady'),
          className:
            'border-uzh-darkgreen-100 bg-uzh-darkgreen-20 text-uzh-darkgreen-100',
        }
      case ChatbotKnowledgeGraphStatus.Failed:
        return {
          label: t('manage.resources.knowledgeGraphStatusFailed'),
          className: 'border-uzh-red-100 bg-uzh-red-20 text-red-950',
        }
    }
  }

  const getResourceStatusLabel = (status: KbResourceStatus) => {
    switch (status) {
      case KbResourceStatus.Added:
        return t('kb.statusAdded')
      case KbResourceStatus.Queued:
        return t('kb.statusQueued')
      case KbResourceStatus.Processing:
        return t('kb.statusProcessing')
      case KbResourceStatus.Ready:
        return t('kb.statusReady')
      case KbResourceStatus.Failed:
        return t('kb.statusFailed')
    }
  }

  const getSpeedModeLabel = (mode: KbSpeedMode | null | undefined) => {
    switch (mode) {
      case KbSpeedMode.Balanced:
        return t('kb.speedModeBalanced')
      case KbSpeedMode.Quality:
        return t('kb.speedModeQuality')
      case KbSpeedMode.Fast:
        return t('kb.speedModeFast')
      default:
        return null
    }
  }

  const statusPresentation = config
    ? getStatusPresentation(config.status)
    : null
  const lastBuildSpeedMode = getSpeedModeLabel(config?.lastBuildSpeedMode)

  return (
    <section
      className="space-y-4 border-t border-gray-200 pt-6"
      data-cy="chatbot-knowledge-graph-panel"
    >
      <div>
        <h4 className="text-lg font-semibold text-[#121212]">
          {t('manage.resources.knowledgeGraphTitle')}
        </h4>
        <p className="mt-1 text-sm text-[#4C4C4C]">
          {t('manage.resources.knowledgeGraphDescription')}
        </p>
      </div>

      {loading && data === undefined ? (
        <p className="text-sm text-[#4C4C4C]" role="status">
          {t('manage.resources.knowledgeGraphLoading')}
        </p>
      ) : error || config === undefined ? (
        <div
          className="border-uzh-red-60 bg-uzh-red-20 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm text-red-950"
          role="alert"
        >
          <span>{t('manage.resources.knowledgeGraphLoadError')}</span>
          <Button
            onClick={() => void refetch()}
            data={{ cy: 'chatbot-knowledge-graph-config-retry' }}
          >
            <Button.Label>
              {t('manage.resources.knowledgeGraphRetry')}
            </Button.Label>
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-[#E9E9E9] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h5 className="font-semibold text-[#121212]">
                  {t('manage.resources.knowledgeGraphResourcesTitle')}
                </h5>
                <p className="mt-1 text-sm text-[#4C4C4C]">
                  {t('manage.resources.knowledgeGraphSelectedCount', {
                    count: selectedResourceIds.length,
                  })}
                </p>
              </div>
              {hasUnsavedSelection ? (
                <Badge
                  variant="outline"
                  className="border-uzh-yellow-100 bg-uzh-yellow-20 text-amber-950"
                >
                  {t('manage.resources.knowledgeGraphUnsavedChanges')}
                </Badge>
              ) : null}
            </div>

            {populatedResourceGroups.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-[#B2B2B2] p-4 text-sm text-[#4C4C4C]">
                {t('manage.resources.knowledgeGraphNoResources')}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {populatedResourceGroups.map((group) => (
                  <fieldset
                    key={group.id}
                    className="rounded-md border border-[#E9E9E9] p-3"
                  >
                    <legend className="px-1 text-sm font-semibold text-[#121212]">
                      {group.name}
                    </legend>
                    {group.description ? (
                      <p className="mb-3 text-xs text-[#4C4C4C]">
                        {group.description}
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      {group.resources.map((resource) => {
                        const assignedElsewhere =
                          resource.assignmentChatbotId !== null &&
                          resource.assignmentChatbotId !== undefined &&
                          resource.assignmentChatbotId !== chatbotId
                        const assignmentName =
                          resource.assignmentChatbotName ??
                          t(
                            'manage.resources.knowledgeGraphUnknownAssignedChatbot'
                          )

                        return (
                          <div
                            key={resource.id}
                            className="rounded-md border border-[#E9E9E9] px-3 py-2"
                          >
                            <Checkbox
                              checked={selectedResourceIdSet.has(resource.id)}
                              disabled={
                                assignedElsewhere ||
                                !selectionReady ||
                                isSavingSelection
                              }
                              onCheck={() => toggleResource(resource.id)}
                              label={resource.title}
                              data={{
                                cy: `chatbot-knowledge-graph-resource-${resource.id}`,
                              }}
                            />
                            <div className="ml-7 mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#4C4C4C]">
                              <span>
                                {resource.type === KbResourceType.Blob
                                  ? t(
                                      'manage.resources.knowledgeGraphResourceFile'
                                    )
                                  : t(
                                      'manage.resources.knowledgeGraphResourceUrl'
                                    )}
                              </span>
                              <span>
                                {getResourceStatusLabel(resource.status)}
                              </span>
                            </div>
                            {assignedElsewhere ? (
                              <p className="ml-7 mt-1 text-xs text-slate-700">
                                {t(
                                  'manage.resources.knowledgeGraphAssignedElsewhere',
                                  { chatbotName: assignmentName }
                                )}
                              </p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#E9E9E9] pt-4">
              <Button
                primary
                loading={isSavingSelection}
                disabled={
                  isSavingSelection || !hasUnsavedSelection || isRebuildingGraph
                }
                onClick={() => void handleSaveSelection()}
                data={{ cy: 'chatbot-knowledge-graph-save' }}
              >
                <Button.Label>
                  {t('manage.resources.knowledgeGraphSaveSelection')}
                </Button.Label>
              </Button>
              {saveSuccess ? (
                <span className="text-uzh-darkgreen-100 text-sm" role="status">
                  {t('manage.resources.knowledgeGraphSelectionSaved')}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-[#E9E9E9] bg-[#FAFAFA] p-4">
            <div className="flex flex-col gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h5 className="font-semibold text-[#121212]">
                  {t('manage.resources.knowledgeGraphBuildTitle')}
                </h5>
                <p className="text-sm text-[#4C4C4C]">
                  {hasUnsavedSelection
                    ? t('manage.resources.knowledgeGraphSaveBeforeBuild')
                    : t('manage.resources.knowledgeGraphBuildDescription')}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                <div className="flex min-w-0 flex-col">
                  <label
                    htmlFor="chatbot-knowledge-graph-speed-mode"
                    className="mb-1 text-sm font-semibold text-[#4C4C4C]"
                  >
                    {t('kb.speedModeLabel')}
                  </label>
                  <Select
                    id="chatbot-knowledge-graph-speed-mode"
                    value={speedMode}
                    items={speedModeItems}
                    onChange={(value) => setSpeedMode(value as KbSpeedMode)}
                    disabled={isActive || isRebuildingGraph}
                    data={{ cy: 'chatbot-knowledge-graph-speed-mode' }}
                    className={{ root: 'w-full', trigger: 'w-full' }}
                  />
                </div>
                <div className="flex min-w-0 flex-col">
                  <label
                    htmlFor="chatbot-knowledge-graph-generation-model"
                    className="mb-1 text-sm font-semibold text-[#4C4C4C]"
                  >
                    {t('manage.resources.knowledgeGraphGenerationModel')}
                  </label>
                  <Select
                    id="chatbot-knowledge-graph-generation-model"
                    value={generationModel}
                    items={KB_MODEL_ITEMS}
                    onChange={(value) =>
                      setGenerationModel(value as KBIngestionModelId)
                    }
                    disabled={isActive || isRebuildingGraph}
                    data={{
                      cy: 'chatbot-knowledge-graph-generation-model',
                    }}
                    className={{ root: 'w-full', trigger: 'w-full' }}
                  />
                </div>
                <div className="flex min-w-0 flex-col">
                  <label
                    htmlFor="chatbot-knowledge-graph-cleaning-model"
                    className="mb-1 text-sm font-semibold text-[#4C4C4C]"
                  >
                    {t('manage.resources.knowledgeGraphCleaningModel')}
                  </label>
                  <Select
                    id="chatbot-knowledge-graph-cleaning-model"
                    value={cleaningModel}
                    items={KB_MODEL_ITEMS}
                    onChange={(value) =>
                      setCleaningModel(value as KBIngestionModelId)
                    }
                    disabled={isActive || isRebuildingGraph}
                    data={{ cy: 'chatbot-knowledge-graph-cleaning-model' }}
                    className={{ root: 'w-full', trigger: 'w-full' }}
                  />
                </div>
                <div className="flex min-w-0 items-end sm:justify-end">
                  <Button
                    primary
                    loading={isRebuildingGraph}
                    disabled={
                      isSavingSelection ||
                      !selectionReady ||
                      isActive ||
                      hasUnsavedSelection ||
                      selectedResourceIds.length === 0
                    }
                    onClick={() => void handleRebuild()}
                    data={{ cy: 'chatbot-knowledge-graph-rebuild' }}
                  >
                    <Button.Label>
                      {config.builtRevision === null ||
                      config.builtRevision === undefined
                        ? t('manage.resources.knowledgeGraphBuild')
                        : t('manage.resources.knowledgeGraphRebuild')}
                    </Button.Label>
                  </Button>
                </div>
              </div>
            </div>

            <div
              className="mt-4 space-y-2 border-t border-[#E9E9E9] pt-4 text-sm"
              aria-live="polite"
              aria-atomic="true"
              data-cy="chatbot-knowledge-graph-status"
            >
              {statusPresentation ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#121212]">
                    {t('manage.resources.knowledgeGraphStatus')}:
                  </span>
                  <Badge
                    variant="outline"
                    className={statusPresentation.className}
                  >
                    {statusPresentation.label}
                  </Badge>
                </div>
              ) : null}
              {config.statusMessage ? (
                <p className="text-[#4C4C4C]">{config.statusMessage}</p>
              ) : null}
              {isActive && config.externalWorkflowRunId ? (
                <p className="break-all text-[#4C4C4C]">
                  {t('manage.resources.knowledgeGraphExternalRun', {
                    runId: config.externalWorkflowRunId,
                  })}
                </p>
              ) : null}
              {config.lastBuiltAt ? (
                <p className="text-[#4C4C4C]">
                  {t('manage.resources.knowledgeGraphLastBuilt', {
                    date: format.dateTime(new Date(config.lastBuiltAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                    speed:
                      lastBuildSpeedMode ??
                      t('manage.resources.knowledgeGraphUnknownSpeed'),
                  })}
                </p>
              ) : null}
            </div>
          </div>

          {operationError ? (
            <p
              className="border-uzh-red-60 bg-uzh-red-20 rounded-md border p-3 text-sm text-red-950"
              role="alert"
            >
              {operationError}
            </p>
          ) : null}

          <div>
            <h5 className="mb-2 font-semibold text-[#121212]">
              {t('manage.resources.knowledgeGraphPreviewTitle')}
            </h5>
            {isPublished && typeof config.builtRevision === 'number' ? (
              <ChatbotKnowledgeGraphPreview
                chatbotId={chatbotId}
                builtRevision={config.builtRevision}
              />
            ) : (
              <div
                className="rounded-lg border border-dashed border-[#B2B2B2] bg-[#FAFAFA] p-6 text-center text-sm text-[#4C4C4C]"
                data-cy="chatbot-knowledge-graph-preview-unavailable"
              >
                {t('manage.resources.knowledgeGraphPreviewUnavailable')}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default ChatbotKnowledgeGraphPanel
