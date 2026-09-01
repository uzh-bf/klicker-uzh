import { useMutation } from '@apollo/client'
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type Chatbot,
  ChatbotStatus,
  type ChatModelCapability,
  CreditResetPeriod,
  GetChatbotsInfoDocument,
  UpdateChatbotModelSettingsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Badge,
  Button,
  H3,
  H4,
  Switch,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ChatbotAuthoring, { metadataEditableStatuses } from './ChatbotAuthoring'
import ChatbotDisclaimerPreview from './ChatbotDisclaimerPreview'
import ChatbotPublicationRequest from './ChatbotPublicationRequest'
import ChatbotWorkspaceNavigation from './ChatbotWorkspaceNavigation'
import { getChatbotStatusTranslationKey } from './chatbotStatus'
import type {
  ChatbotNavigationState,
  ChatbotSetupStep,
  ChatbotWorkspaceView,
} from './chatbotWorkspace'

type ReasoningConfigState = Record<string, string[]>

const overviewReadOnlyStatuses = [
  ChatbotStatus.PendingApproval,
  ChatbotStatus.Paused,
  ChatbotStatus.Published,
]

const orderEffortsBy = (
  efforts: readonly string[],
  order: readonly string[]
): string[] => {
  const effortSet = new Set(efforts)
  return order.filter((effort) => effortSet.has(effort))
}

const buildReasoningConfigState = (
  chatbot: Chatbot,
  modelRegistry: ChatModelCapability[]
): ReasoningConfigState => {
  const existingConfig = new Map(
    (chatbot.allowedReasoningEffortsByModel ?? []).map((entry) => [
      entry.modelId,
      entry.efforts,
    ])
  )

  const nextState: ReasoningConfigState = {}
  for (const model of modelRegistry) {
    if (!model.supportsReasoning) continue

    const supportedEfforts = model.supportedReasoningEfforts
    const configuredEfforts = existingConfig.get(model.id)
    if (configuredEfforts && configuredEfforts.length > 0) {
      const intersected = orderEffortsBy(configuredEfforts, supportedEfforts)
      nextState[model.id] =
        intersected.length > 0 ? intersected : [...supportedEfforts]
    } else {
      nextState[model.id] = [...supportedEfforts]
    }
  }

  return nextState
}

function ChatbotDetails({
  chatbot,
  modelRegistry,
  loading,
  view,
  step,
  onNavigate,
  onNavigationStateChange,
  publishingAuthorized,
  publishingAuthorizationLoading,
  publishingAuthorizationError,
}: {
  chatbot?: Chatbot
  modelRegistry: ChatModelCapability[]
  loading: boolean
  view: ChatbotWorkspaceView
  step?: ChatbotSetupStep
  onNavigate: (
    view: ChatbotWorkspaceView,
    step?: ChatbotSetupStep,
    internal?: boolean
  ) => void
  onNavigationStateChange: (state: ChatbotNavigationState) => void
  publishingAuthorized: boolean
  publishingAuthorizationLoading: boolean
  publishingAuthorizationError: boolean
}) {
  const t = useTranslations()
  const { locale } = useRouter()
  const [updateChatbotModelSettings, { loading: isSaving }] = useMutation(
    UpdateChatbotModelSettingsDocument
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [modelSelectionEnabled, setModelSelectionEnabled] = useState(false)
  const [useAllModels, setUseAllModels] = useState(true)
  const [allowedModelIds, setAllowedModelIds] = useState<string[]>([])
  const [reasoningConfig, setReasoningConfig] = useState<ReasoningConfigState>(
    {}
  )
  const [authoringNavigationState, setAuthoringNavigationState] =
    useState<ChatbotNavigationState>({ dirty: false, pending: false })

  const reasoningModels = useMemo(
    () => modelRegistry.filter((model) => model.supportsReasoning),
    [modelRegistry]
  )

  const supportedEffortsByModelId = useMemo(
    () =>
      new Map(
        modelRegistry.map((model) => [
          model.id,
          model.supportedReasoningEfforts,
        ])
      ),
    [modelRegistry]
  )

  useEffect(() => {
    if (!chatbot) return

    setModelSelectionEnabled(chatbot.modelSelection)
    setUseAllModels(chatbot.allowedModelIds.length === 0)
    setAllowedModelIds(chatbot.allowedModelIds)
    setReasoningConfig(buildReasoningConfigState(chatbot, modelRegistry))
    setSaveError(null)
    setSaveSuccess(false)
  }, [chatbot, modelRegistry])

  const modelSettingsDirty = useMemo(() => {
    if (!chatbot) return false

    const initialUseAllModels = chatbot.allowedModelIds.length === 0
    const initialAllowedModelIds = [...chatbot.allowedModelIds].sort()
    const currentAllowedModelIds = [...allowedModelIds].sort()
    const initialReasoningConfig = buildReasoningConfigState(
      chatbot,
      modelRegistry
    )

    return (
      modelSelectionEnabled !== chatbot.modelSelection ||
      useAllModels !== initialUseAllModels ||
      JSON.stringify(currentAllowedModelIds) !==
        JSON.stringify(initialAllowedModelIds) ||
      JSON.stringify(reasoningConfig) !== JSON.stringify(initialReasoningConfig)
    )
  }, [
    allowedModelIds,
    chatbot,
    modelRegistry,
    modelSelectionEnabled,
    reasoningConfig,
    useAllModels,
  ])

  useEffect(() => {
    onNavigationStateChange(
      view === 'advanced'
        ? { dirty: modelSettingsDirty, pending: isSaving }
        : view === 'setup'
          ? authoringNavigationState
          : { dirty: false, pending: false }
    )
  }, [
    authoringNavigationState,
    isSaving,
    modelSettingsDirty,
    onNavigationStateChange,
    view,
  ])

  useEffect(() => {
    if (view === 'advanced' || !chatbot) return
    setModelSelectionEnabled(chatbot.modelSelection)
    setUseAllModels(chatbot.allowedModelIds.length === 0)
    setAllowedModelIds(chatbot.allowedModelIds)
    setReasoningConfig(buildReasoningConfigState(chatbot, modelRegistry))
    setSaveError(null)
    setSaveSuccess(false)
  }, [chatbot, modelRegistry, view])

  if (loading) {
    return <Loader />
  }

  if (!chatbot) {
    return (
      <UserNotification className={{ root: 'mt-1.5' }}>
        {t('manage.resources.noChatbots')}
      </UserNotification>
    )
  }

  const resetPeriodLabel = (() => {
    switch (chatbot.creditResetPeriod) {
      case CreditResetPeriod.Daily:
        return t('manage.resources.creditResetPeriodDaily')
      case CreditResetPeriod.Weekly:
        return t('manage.resources.creditResetPeriodWeekly')
      case CreditResetPeriod.Biweekly:
        return t('manage.resources.creditResetPeriodBiweekly')
      case CreditResetPeriod.Monthly:
        return t('manage.resources.creditResetPeriodMonthly')
      case CreditResetPeriod.None:
        return t('manage.resources.creditResetPeriodNone')
      default:
        return chatbot.creditResetPeriod
    }
  })()

  const createdAtLabel = chatbot.createdAt
    ? dayjs(chatbot.createdAt).format('DD.MM.YYYY HH:mm')
    : t('shared.generic.unknown')
  const updatedAtLabel = chatbot.updatedAt
    ? dayjs(chatbot.updatedAt).format('DD.MM.YYYY HH:mm')
    : t('shared.generic.unknown')

  const usageSummary = chatbot.usageSummary
  const lastActivityLabel = usageSummary?.lastActivityAt
    ? dayjs(usageSummary.lastActivityAt).format('DD.MM.YYYY HH:mm')
    : t('shared.generic.unknown')
  const lastResetLabel = usageSummary?.lastResetAt
    ? dayjs(usageSummary.lastResetAt).format('DD.MM.YYYY HH:mm')
    : t('shared.generic.unknown')

  const formatNumber = (value?: number | null) =>
    value === null || value === undefined
      ? t('shared.generic.unknown')
      : value.toLocaleString()

  const pwaBaseUrl = (
    process.env.NEXT_PUBLIC_PWA_URL ?? 'https://pwa.klicker.com'
  ).replace(/\/$/, '')
  const localePrefix = locale ? `/${locale}` : ''
  const buildChatbotUrl = (courseId: string) =>
    `${pwaBaseUrl}${localePrefix}/course/${encodeURIComponent(courseId)}/chatbot/${encodeURIComponent(chatbot.id)}`
  const chatbotStatusLabel = t(getChatbotStatusTranslationKey(chatbot.status))
  const modelSettingsEditable = metadataEditableStatuses.includes(
    chatbot.status
  )
  const showOverviewReadOnlyDetails = overviewReadOnlyStatuses.includes(
    chatbot.status
  )

  const handleAllowedModelToggle = (modelId: string, checked: boolean) => {
    setSaveError(null)
    setSaveSuccess(false)
    setAllowedModelIds((currentAllowedModelIds) => {
      const modelSet = new Set(currentAllowedModelIds)
      if (checked) {
        modelSet.add(modelId)
      } else {
        modelSet.delete(modelId)
      }
      return Array.from(modelSet)
    })
  }

  const handleAllModelsToggle = (checked: boolean) => {
    setSaveError(null)
    setSaveSuccess(false)
    setUseAllModels(checked)
    if (!checked && allowedModelIds.length === 0) {
      setAllowedModelIds(modelRegistry.map((model) => model.id))
    }
  }

  const handleReasoningEffortToggle = (
    modelId: string,
    effort: string,
    checked: boolean
  ) => {
    setSaveError(null)
    setSaveSuccess(false)
    setReasoningConfig((currentConfig) => {
      const existingEfforts = currentConfig[modelId] ?? []
      const effortSet = new Set(existingEfforts)
      if (checked) {
        effortSet.add(effort)
      } else if (effortSet.size > 1) {
        effortSet.delete(effort)
      }

      const supportedOrder = supportedEffortsByModelId.get(modelId) ?? []
      const nextEfforts = orderEffortsBy(Array.from(effortSet), supportedOrder)

      return {
        ...currentConfig,
        [modelId]: nextEfforts,
      }
    })
  }

  const handleSaveModelSettings = async () => {
    setSaveError(null)
    setSaveSuccess(false)

    const normalizedAllowedModelIds = useAllModels
      ? []
      : Array.from(new Set(allowedModelIds)).sort()
    const normalizedReasoningConfig = reasoningModels.map((model) => {
      const configuredEfforts = orderEffortsBy(
        reasoningConfig[model.id] ?? model.supportedReasoningEfforts,
        model.supportedReasoningEfforts
      )

      return {
        modelId: model.id,
        efforts: configuredEfforts,
      }
    })

    try {
      await updateChatbotModelSettings({
        variables: {
          chatbotId: chatbot.id,
          modelSelection: modelSelectionEnabled,
          allowedModelIds: normalizedAllowedModelIds,
          allowedReasoningEffortsByModel: normalizedReasoningConfig,
        },
        refetchQueries: [{ query: GetChatbotsInfoDocument }],
        awaitRefetchQueries: true,
      })

      setSaveSuccess(true)
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : t('manage.resources.chatbotModelSettingsSaveError')
      )
    }
  }

  return (
    <div data-cy="chatbot-details">
      <div className="space-y-6">
        <div>
          <div className="flex flex-row items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <H3 className={{ root: 'mb-0 text-xl font-bold' }}>
                {chatbot.name}
              </H3>
              <Badge
                className="bg-gray-100 text-gray-800 hover:bg-gray-200"
                data-cy="chatbot-status"
              >
                {chatbotStatusLabel}
              </Badge>
            </div>
          </div>
          {chatbot.description && (
            <div className="mt-1 text-sm text-gray-600">
              {chatbot.description}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-gray-500">
            <div>
              ID: <span className="select-all">{chatbot.id}</span>
            </div>
            {chatbot.avatar && (
              <div className="flex max-w-full items-center gap-1">
                <span>Avatar:</span>
                <span className="max-w-[200px] truncate" title={chatbot.avatar}>
                  {chatbot.avatar}
                </span>
              </div>
            )}
          </div>
        </div>

        {chatbot.courses && chatbot.courses.length > 0 && (
          <div>
            <div className="mb-1 text-sm font-medium text-gray-700">
              {t('manage.resources.linkedCourses')}
            </div>
            <ul className="list-disc pl-5 text-sm text-gray-600">
              {chatbot.courses.map((course) => (
                <li
                  key={`chatbot-course-${course.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <Link
                    href={`/courses/${course.id}`}
                    className="text-primary-600 hover:text-primary-800 hover:underline"
                  >
                    {course.name}
                  </Link>
                  {chatbot.status === ChatbotStatus.Published ? (
                    <a
                      href={buildChatbotUrl(course.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-500 hover:text-primary-700 flex items-center gap-1.5 whitespace-nowrap text-xs hover:underline"
                      data-cy="chatbot-participant-link"
                    >
                      <span>{t('manage.resources.openChatbot')}</span>
                      <FontAwesomeIcon
                        icon={faExternalLinkAlt}
                        className="h-3 w-3"
                      />
                    </a>
                  ) : (
                    <span
                      className="whitespace-nowrap text-xs text-gray-500"
                      data-cy="chatbot-not-live"
                    >
                      {t('manage.resources.chatbotNotLive')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ChatbotWorkspaceNavigation
          view={view}
          step={step}
          setupAvailable={
            chatbot.status !== ChatbotStatus.PendingApproval &&
            chatbot.status !== ChatbotStatus.Paused
          }
          onNavigate={onNavigate}
        />

        {view === 'overview' ? (
          <section
            className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            data-cy="chatbot-overview"
          >
            <H4>{t('manage.resources.chatbotWorkspaceOverview')}</H4>
            <p className="text-sm text-gray-600">
              {t('manage.resources.chatbotWorkspaceOverviewDescription')}
            </p>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="font-medium text-gray-600">
                  {t('shared.generic.status')}
                </dt>
                <dd className="mt-1 text-gray-900">{chatbotStatusLabel}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-600">
                  {t('manage.resources.chatbotCreatedAt')}
                </dt>
                <dd className="mt-1 text-gray-900">{createdAtLabel}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-600">
                  {t('manage.resources.chatbotUpdatedAt')}
                </dt>
                <dd className="mt-1 text-gray-900">{updatedAtLabel}</dd>
              </div>
            </dl>
            {showOverviewReadOnlyDetails ? (
              <>
                <div className="border-t border-gray-200 pt-3">
                  <H4>{t('manage.resources.chatbotDisclaimerPreview')}</H4>
                  <p className="mb-3 text-sm text-gray-600">
                    {t('manage.resources.chatbotDisclaimerPreviewDescription')}
                  </p>
                  <ChatbotDisclaimerPreview
                    title={chatbot.disclaimerSummary?.title ?? ''}
                    introText={chatbot.disclaimerSummary?.introText ?? ''}
                  />
                </div>
                <ChatbotPublicationRequest
                  chatbot={chatbot}
                  publishingAuthorized={publishingAuthorized}
                  publishingAuthorizationLoading={
                    publishingAuthorizationLoading
                  }
                  publishingAuthorizationError={publishingAuthorizationError}
                />
              </>
            ) : null}
          </section>
        ) : null}

        {view === 'setup' ? (
          <ChatbotAuthoring
            key={chatbot.id}
            chatbot={chatbot}
            step={step ?? 'basics'}
            publishingAuthorized={publishingAuthorized}
            publishingAuthorizationLoading={publishingAuthorizationLoading}
            publishingAuthorizationError={publishingAuthorizationError}
            onNavigate={onNavigate}
            onNavigationStateChange={setAuthoringNavigationState}
          />
        ) : null}

        {view === 'usage' ? (
          <div className="space-y-6" data-cy="chatbot-usage">
            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">
                {t('manage.resources.credits')}
              </div>
              <div className="overflow-hidden rounded-lg border shadow-sm">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <tr className="divide-x divide-gray-200">
                      <td className="w-1/3 bg-gray-50 px-4 py-2 font-medium text-gray-500">
                        {t('manage.resources.creditInitialCredits')}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {chatbot.creditInitialCredits}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                        {t('manage.resources.creditResetPeriod')}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {resetPeriodLabel}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                        {t('manage.resources.creditResetAmount')}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {chatbot.creditResetAmount}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                        {t('manage.resources.creditMaxCredits')}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {chatbot.creditMaxCredits}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">
                {t('manage.resources.usageSummary')}
              </div>
              <div className="overflow-hidden rounded-lg border shadow-sm">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <tr className="divide-x divide-gray-200">
                      <td className="w-1/3 bg-gray-50 px-4 py-2 font-medium text-gray-500">
                        {t('manage.resources.usageThreads')}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {usageSummary?.threadCount ?? 0}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                        {t('manage.resources.usageMessages')}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {usageSummary?.messageCount ?? 0}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                        {t('manage.resources.usageParticipants')}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {usageSummary?.participantCount ?? 0}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                        {t('manage.resources.usageLastActivity')}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {lastActivityLabel}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                        {t('manage.resources.usageTotalCredits')}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {formatNumber(usageSummary?.totalCredits)}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                        {t('manage.resources.usageCurrentCredits')}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {formatNumber(usageSummary?.currentCredits)}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                        {t('manage.resources.usageTotalResets')}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {usageSummary?.totalResets ?? 0}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <td className="bg-gray-50 px-4 py-2 font-medium text-gray-500">
                        {t('manage.resources.usageLastReset')}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {lastResetLabel}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {chatbot.disclaimerSummary && (
              <div>
                <div className="mb-2 text-sm font-medium text-gray-700">
                  {t('manage.resources.disclaimer')}
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div className="mb-1 font-semibold text-gray-900">
                    {chatbot.disclaimerSummary.title}
                  </div>
                  <div className="mb-3 text-gray-600">
                    {chatbot.disclaimerSummary.name}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                      {t('manage.resources.disclaimerAccepted')}:{' '}
                      {chatbot.disclaimerSummary.acceptedCount}
                    </Badge>
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
                      {t('manage.resources.disclaimerDeclined')}:{' '}
                      {chatbot.disclaimerSummary.declinedCount}
                    </Badge>
                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                      {t('manage.resources.disclaimerPending')}:{' '}
                      {chatbot.disclaimerSummary.pendingCount}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {chatbot.mcpConfigurations &&
              chatbot.mcpConfigurations.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">
                    {t('manage.resources.mcpConfigurations')}
                  </div>
                  <div className="overflow-hidden rounded-lg border shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                          <th className="px-4 py-2">
                            {t('shared.generic.server')}
                          </th>
                          <th className="px-4 py-2">
                            {t('manage.resources.mcpChatMode')}
                          </th>
                          <th className="px-4 py-2">
                            {t('manage.resources.mcpStatus')}
                          </th>
                          <th className="px-4 py-2">
                            {t('manage.resources.mcpPriority')}
                          </th>
                          <th className="px-4 py-2">
                            {t('manage.resources.mcpAllowedTools')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {chatbot.mcpConfigurations.map((config) => (
                          <tr
                            key={`${chatbot.id}-${config.serverId}-${config.chatMode}`}
                          >
                            <td className="px-4 py-2">
                              <div className="font-medium text-gray-900">
                                {config.serverName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {config.serverIsActive
                                  ? t('manage.resources.mcpServerActive')
                                  : t('manage.resources.mcpServerInactive')}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-gray-500">
                              {config.chatMode}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={twMerge(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                                  config.isEnabled
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                )}
                              >
                                {config.isEnabled
                                  ? t('manage.resources.mcpStatusEnabled')
                                  : t('manage.resources.mcpStatusDisabled')}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-500">
                              {config.priority}
                            </td>
                            <td className="px-4 py-2 text-gray-500">
                              {config.allowedToolsCount ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </div>
        ) : null}

        {view === 'advanced' ? (
          <div className="space-y-6" data-cy="chatbot-advanced">
            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">
                {t('manage.resources.chatbotModelSettings')}
              </div>
              <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-700">
                      {t('manage.resources.modelSelection')}
                    </span>
                    <Switch
                      checked={modelSelectionEnabled}
                      disabled={isSaving || !modelSettingsEditable}
                      onCheckedChange={(checked) => {
                        setSaveError(null)
                        setSaveSuccess(false)
                        setModelSelectionEnabled(checked)
                      }}
                      data={{ cy: 'chatbot-model-selection-switch' }}
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    {modelSelectionEnabled
                      ? t('manage.resources.modelSelectionEnabledDescription')
                      : t('manage.resources.modelSelectionDisabledDescription')}
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={useAllModels}
                      disabled={isSaving || !modelSettingsEditable}
                      data-cy="chatbot-models-all"
                      onChange={(event) =>
                        handleAllModelsToggle(event.target.checked)
                      }
                    />
                    {t('manage.resources.allowedModelsAll')}
                  </label>

                  <div className="grid gap-2 md:grid-cols-2">
                    {modelRegistry.map((model) => {
                      const checked = useAllModels
                        ? true
                        : allowedModelIds.includes(model.id)
                      return (
                        <label
                          key={`allowed-model-${model.id}`}
                          className={twMerge(
                            'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
                            checked
                              ? 'border-blue-300 bg-blue-50 text-blue-900'
                              : 'border-gray-200 text-gray-700',
                            useAllModels ? 'opacity-60' : ''
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4"
                            checked={checked}
                            disabled={
                              isSaving || useAllModels || !modelSettingsEditable
                            }
                            data-cy={`chatbot-model-${model.id}`}
                            onChange={(event) =>
                              handleAllowedModelToggle(
                                model.id,
                                event.target.checked
                              )
                            }
                          />
                          <span className="flex flex-col">
                            <span className="font-medium">{model.name}</span>
                            <span className="text-xs text-gray-500">
                              {model.description}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {reasoningModels.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <div className="text-sm font-medium text-gray-700">
                      {t('manage.resources.reasoningEffortsByModel')}
                    </div>

                    <div className="space-y-3">
                      {reasoningModels.map((model) => {
                        const supportedEfforts = model.supportedReasoningEfforts
                        const configuredEfforts = orderEffortsBy(
                          reasoningConfig[model.id] ?? supportedEfforts,
                          supportedEfforts
                        )
                        const isFixedReasoning = supportedEfforts.length <= 1

                        return (
                          <div
                            key={`reasoning-model-${model.id}`}
                            className="rounded-md border border-gray-200 bg-gray-50 p-3"
                          >
                            <div className="mb-2 text-sm font-semibold text-gray-800">
                              {model.name}
                            </div>

                            {isFixedReasoning ? (
                              <div className="text-xs text-gray-600">
                                {t(
                                  'manage.resources.singleReasoningEffortFixed',
                                  {
                                    effort: supportedEfforts[0],
                                  }
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {supportedEfforts.map((effort) => {
                                  const checked =
                                    configuredEfforts.includes(effort)
                                  const canToggleOff =
                                    configuredEfforts.length > 1
                                  return (
                                    <label
                                      key={`reasoning-effort-${model.id}-${effort}`}
                                      className={twMerge(
                                        'flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
                                        checked
                                          ? 'border-blue-300 bg-blue-50 text-blue-900'
                                          : 'border-gray-300 text-gray-700',
                                        !checked && !canToggleOff
                                          ? 'opacity-60'
                                          : ''
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5"
                                        checked={checked}
                                        disabled={
                                          isSaving || !modelSettingsEditable
                                        }
                                        data-cy={`chatbot-reasoning-${model.id}-${effort}`}
                                        onChange={(event) =>
                                          handleReasoningEffortToggle(
                                            model.id,
                                            effort,
                                            event.target.checked
                                          )
                                        }
                                      />
                                      <span>{effort}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 border-t pt-4">
                  <Button
                    onClick={handleSaveModelSettings}
                    disabled={isSaving || !modelSettingsEditable}
                    data={{ cy: 'chatbot-model-settings-save' }}
                  >
                    <Button.Label>
                      {isSaving
                        ? t('manage.resources.chatbotModelSettingsSaving')
                        : t('manage.resources.chatbotModelSettingsSave')}
                    </Button.Label>
                  </Button>
                  {saveSuccess && (
                    <span className="text-xs text-green-700">
                      {t('manage.resources.chatbotModelSettingsSaveSuccess')}
                    </span>
                  )}
                </div>

                {!modelSettingsEditable ? (
                  <UserNotification>
                    {t('manage.resources.chatbotModelSettingsReadonly')}
                  </UserNotification>
                ) : null}

                {saveError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {saveError}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-4 border-t pt-4 text-xs text-gray-500">
              <div>
                {t('manage.resources.modelSelection')}:{' '}
                {modelSelectionEnabled
                  ? t('manage.resources.modelSelectionEnabled')
                  : t('manage.resources.modelSelectionDisabled')}
              </div>
              <div>•</div>
              <div>
                {t('manage.resources.allowedModels')}:{' '}
                {useAllModels
                  ? t('manage.resources.allowedModelsAll')
                  : allowedModelIds.length > 0
                    ? allowedModelIds.join(', ')
                    : t('manage.resources.allowedModelsAll')}
              </div>
              <div>•</div>
              <div>
                {t('shared.generic.createdAt', {
                  date: createdAtLabel,
                })}
              </div>
              <div>•</div>
              <div>
                {t('shared.generic.updatedAt', {
                  date: updatedAtLabel,
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ChatbotDetails
