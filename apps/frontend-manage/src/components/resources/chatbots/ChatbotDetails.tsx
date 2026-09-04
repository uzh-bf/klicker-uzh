import { useMutation } from '@apollo/client'
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type Chatbot,
  ChatbotStatus,
  type ChatModelCapability,
  CreditResetPeriod,
  MUpdateChatbotModelPolicyDocument,
  QGetChatbotsInfoWithStandardModesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Badge,
  Button,
  Checkbox,
  H3,
  H4,
  Select,
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
  modelRegistry: ChatModelCapability[],
  fixedModelId?: string
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
    if (!chatbot.modelSelection && model.id === fixedModelId) {
      const configuredSupportedEfforts = orderEffortsBy(
        configuredEfforts ?? supportedEfforts,
        supportedEfforts
      )
      const effectiveEfforts =
        configuredSupportedEfforts.length > 0
          ? configuredSupportedEfforts
          : supportedEfforts
      const preferredEffort = effectiveEfforts.includes('medium')
        ? 'medium'
        : (effectiveEfforts[0] ?? supportedEfforts[0])
      nextState[model.id] = preferredEffort ? [preferredEffort] : []
      continue
    }
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

function getDefaultFixedModelId(
  chatbot: Chatbot,
  modelRegistry: ChatModelCapability[]
) {
  const activeModelIds = new Set(modelRegistry.map((model) => model.id))
  const configuredModelId = chatbot.allowedModelIds.find((modelId) =>
    activeModelIds.has(modelId)
  )
  if (configuredModelId) return configuredModelId

  return (
    modelRegistry.find((model) => !model.fallback)?.id ??
    modelRegistry[0]?.id ??
    ''
  )
}

function getInitialSelectedModelIds(
  chatbot: Chatbot,
  modelRegistry: ChatModelCapability[]
) {
  if (!chatbot.modelSelection) {
    const fixedModelId = getDefaultFixedModelId(chatbot, modelRegistry)
    return fixedModelId ? [fixedModelId] : []
  }

  const activeModelIds = new Set(modelRegistry.map((model) => model.id))
  const configuredModelIds = chatbot.allowedModelIds.filter((modelId) =>
    activeModelIds.has(modelId)
  )
  return configuredModelIds.length > 0
    ? Array.from(new Set(configuredModelIds))
    : modelRegistry.map((model) => model.id)
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  const normalize = (values: readonly string[]) =>
    Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
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
  const [updateChatbotModelPolicy, { loading: isSaving }] = useMutation(
    MUpdateChatbotModelPolicyDocument
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [modelSelectionEnabled, setModelSelectionEnabled] = useState(false)
  const [fixedModelId, setFixedModelId] = useState('')
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
    setFixedModelId(getDefaultFixedModelId(chatbot, modelRegistry))
    setAllowedModelIds(getInitialSelectedModelIds(chatbot, modelRegistry))
    setReasoningConfig(
      buildReasoningConfigState(
        chatbot,
        modelRegistry,
        getDefaultFixedModelId(chatbot, modelRegistry)
      )
    )
    setSaveError(null)
    setSaveSuccess(false)
  }, [chatbot, modelRegistry])

  const modelSettingsDirty = useMemo(() => {
    if (!chatbot) return false

    const initialSelectedModelIds = getInitialSelectedModelIds(
      chatbot,
      modelRegistry
    )
    const currentSelectedModelIds = modelSelectionEnabled
      ? allowedModelIds
      : fixedModelId
        ? [fixedModelId]
        : []
    const initialReasoningConfig = buildReasoningConfigState(
      chatbot,
      modelRegistry,
      getDefaultFixedModelId(chatbot, modelRegistry)
    )
    const selectedModelIds = currentSelectedModelIds
    const reasoningConfigIsDirty = modelRegistry
      .filter(
        (model) =>
          model.supportsReasoning && selectedModelIds.includes(model.id)
      )
      .some(
        (model) =>
          JSON.stringify(
            orderEffortsBy(
              reasoningConfig[model.id] ?? model.supportedReasoningEfforts,
              model.supportedReasoningEfforts
            )
          ) !==
          JSON.stringify(
            orderEffortsBy(
              initialReasoningConfig[model.id] ??
                model.supportedReasoningEfforts,
              model.supportedReasoningEfforts
            )
          )
      )

    return (
      modelSelectionEnabled !== chatbot.modelSelection ||
      !sameStringSet(currentSelectedModelIds, initialSelectedModelIds) ||
      reasoningConfigIsDirty
    )
  }, [
    allowedModelIds,
    chatbot,
    modelRegistry,
    modelSelectionEnabled,
    reasoningConfig,
    fixedModelId,
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
    setFixedModelId(getDefaultFixedModelId(chatbot, modelRegistry))
    setAllowedModelIds(getInitialSelectedModelIds(chatbot, modelRegistry))
    setReasoningConfig(
      buildReasoningConfigState(
        chatbot,
        modelRegistry,
        getDefaultFixedModelId(chatbot, modelRegistry)
      )
    )
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

  const handleFixedModelChange = (modelId: string) => {
    setSaveError(null)
    setSaveSuccess(false)
    setFixedModelId(modelId)
  }

  const handleModelSelectionChange = (checked: boolean) => {
    setSaveError(null)
    setSaveSuccess(false)
    setModelSelectionEnabled(checked)

    if (checked && fixedModelId) {
      setAllowedModelIds([fixedModelId])
      return
    }

    if (!checked && !allowedModelIds.includes(fixedModelId)) {
      setFixedModelId(allowedModelIds[0] ?? modelRegistry[0]?.id ?? '')
    }
  }

  const handleReasoningEffortChange = (modelId: string, effort: string) => {
    setSaveError(null)
    setSaveSuccess(false)
    setReasoningConfig((currentConfig) => {
      return {
        ...currentConfig,
        [modelId]: [effort],
      }
    })
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

    const normalizedAllowedModelIds = modelSelectionEnabled
      ? Array.from(new Set(allowedModelIds)).sort()
      : fixedModelId
        ? [fixedModelId]
        : []
    const selectedModelIdSet = new Set(normalizedAllowedModelIds)
    const normalizedReasoningConfig = reasoningModels
      .filter((model) => selectedModelIdSet.has(model.id))
      .map((model) => {
        const configuredEfforts = orderEffortsBy(
          reasoningConfig[model.id] ?? model.supportedReasoningEfforts,
          model.supportedReasoningEfforts
        )
        const efforts = modelSelectionEnabled
          ? configuredEfforts
          : [
              configuredEfforts.includes('medium')
                ? 'medium'
                : (configuredEfforts[0] ??
                  model.supportedReasoningEfforts[0] ??
                  'medium'),
            ]

        return { modelId: model.id, efforts }
      })

    try {
      await updateChatbotModelPolicy({
        variables: {
          chatbotId: chatbot.id,
          modelSelection: modelSelectionEnabled,
          allowedModelIds: normalizedAllowedModelIds,
          allowedReasoningEffortsByModel: normalizedReasoningConfig,
        },
        refetchQueries: [{ query: QGetChatbotsInfoWithStandardModesDocument }],
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
                      <th
                        scope="row"
                        className="w-1/3 bg-gray-50 px-4 py-2 text-left font-medium text-gray-500"
                      >
                        {t('manage.resources.usageThreads')}
                      </th>
                      <td className="px-4 py-2 text-gray-900">
                        {usageSummary?.threadCount ?? 0}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <th
                        scope="row"
                        className="bg-gray-50 px-4 py-2 text-left font-medium text-gray-500"
                      >
                        {t('manage.resources.usageMessages')}
                      </th>
                      <td className="px-4 py-2 text-gray-900">
                        {usageSummary?.messageCount ?? 0}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <th
                        scope="row"
                        className="bg-gray-50 px-4 py-2 text-left font-medium text-gray-500"
                      >
                        {t('manage.resources.usageParticipants')}
                      </th>
                      <td className="px-4 py-2 text-gray-900">
                        {usageSummary?.participantCount ?? 0}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <th
                        scope="row"
                        className="bg-gray-50 px-4 py-2 text-left font-medium text-gray-500"
                      >
                        {t('manage.resources.usageLastActivity')}
                      </th>
                      <td className="px-4 py-2 text-gray-900">
                        {lastActivityLabel}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <th
                        scope="row"
                        className="bg-gray-50 px-4 py-2 text-left font-medium text-gray-500"
                      >
                        {t('manage.resources.usageTotalCredits')}
                      </th>
                      <td className="px-4 py-2 text-gray-900">
                        {formatNumber(usageSummary?.totalCredits)}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <th
                        scope="row"
                        className="bg-gray-50 px-4 py-2 text-left font-medium text-gray-500"
                      >
                        {t('manage.resources.usageCurrentCredits')}
                      </th>
                      <td className="px-4 py-2 text-gray-900">
                        {formatNumber(usageSummary?.currentCredits)}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <th
                        scope="row"
                        className="bg-gray-50 px-4 py-2 text-left font-medium text-gray-500"
                      >
                        {t('manage.resources.usageTotalResets')}
                      </th>
                      <td className="px-4 py-2 text-gray-900">
                        {usageSummary?.totalResets ?? 0}
                      </td>
                    </tr>
                    <tr className="divide-x divide-gray-200">
                      <th
                        scope="row"
                        className="bg-gray-50 px-4 py-2 text-left font-medium text-gray-500"
                      >
                        {t('manage.resources.usageLastReset')}
                      </th>
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
                    <label
                      htmlFor="chatbot-model-selection-switch"
                      className="text-sm font-medium text-gray-700"
                    >
                      {t('manage.resources.modelSelection')}
                    </label>
                    <Switch
                      id="chatbot-model-selection-switch"
                      checked={modelSelectionEnabled}
                      disabled={isSaving || !modelSettingsEditable}
                      onCheckedChange={handleModelSelectionChange}
                      data={{ cy: 'chatbot-model-selection-switch' }}
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    {modelSelectionEnabled
                      ? t('manage.resources.modelSelectionEnabledDescription')
                      : t('manage.resources.modelSelectionDisabledDescription')}
                  </div>
                </div>

                {!modelSelectionEnabled ? (
                  <div className="space-y-2 border-t pt-4">
                    <label
                      htmlFor="chatbot-fixed-model"
                      className="text-sm font-medium text-gray-700"
                    >
                      {t('manage.resources.selectedModel')}
                    </label>
                    <p className="text-xs text-gray-500">
                      {t('manage.resources.modelSelectionFixedDescription')}
                    </p>
                    <Select
                      id="chatbot-fixed-model"
                      data={{ cy: 'chatbot-fixed-model' }}
                      value={fixedModelId}
                      disabled={isSaving || !modelSettingsEditable}
                      items={modelRegistry.map((model) => ({
                        value: model.id,
                        label: model.name,
                        tooltip: model.description,
                      }))}
                      onChange={handleFixedModelChange}
                    />
                  </div>
                ) : (
                  <div className="space-y-2 border-t pt-4">
                    <div className="text-sm font-medium text-gray-700">
                      {t('manage.resources.allowedModels')}
                    </div>
                    <p className="text-xs text-gray-500">
                      {t(
                        'manage.resources.modelSelectionParticipantDescription'
                      )}
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {modelRegistry.map((model) => {
                        const checked = allowedModelIds.includes(model.id)
                        const isLastSelected =
                          checked && allowedModelIds.length === 1
                        return (
                          <div
                            key={`allowed-model-${model.id}`}
                            className={twMerge(
                              'rounded-md border px-3 py-2 text-sm',
                              checked
                                ? 'border-blue-300 bg-blue-50 text-blue-900'
                                : 'border-gray-200 text-gray-700'
                            )}
                          >
                            <Checkbox
                              id={`chatbot-model-${model.id}`}
                              checked={checked}
                              disabled={
                                isSaving ||
                                !modelSettingsEditable ||
                                isLastSelected
                              }
                              aria-label={model.name}
                              data={{ cy: `chatbot-model-${model.id}` }}
                              onCheck={() =>
                                handleAllowedModelToggle(model.id, !checked)
                              }
                              label={
                                <span className="flex flex-col">
                                  <span className="font-medium">
                                    {model.name}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {model.description}
                                  </span>
                                </span>
                              }
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {reasoningModels.some((model) =>
                  modelSelectionEnabled
                    ? allowedModelIds.includes(model.id)
                    : model.id === fixedModelId
                ) && (
                  <div className="space-y-3 border-t pt-4">
                    <div className="text-sm font-medium text-gray-700">
                      {t('manage.resources.reasoningEffortsByModel')}
                    </div>

                    <div className="space-y-3">
                      {reasoningModels
                        .filter((model) =>
                          modelSelectionEnabled
                            ? allowedModelIds.includes(model.id)
                            : model.id === fixedModelId
                        )
                        .map((model) => {
                          const supportedEfforts =
                            model.supportedReasoningEfforts
                          const configuredEfforts = orderEffortsBy(
                            reasoningConfig[model.id] ?? supportedEfforts,
                            supportedEfforts
                          )
                          const selectedEffort =
                            !modelSelectionEnabled &&
                            configuredEfforts.includes('medium')
                              ? 'medium'
                              : (configuredEfforts[0] ?? supportedEfforts[0])

                          return (
                            <div
                              key={`reasoning-model-${model.id}`}
                              className="rounded-md border border-gray-200 bg-gray-50 p-3"
                            >
                              <div className="mb-2 text-sm font-semibold text-gray-800">
                                {model.name}
                              </div>

                              {!modelSelectionEnabled ? (
                                <div className="space-y-2">
                                  <label
                                    htmlFor={`chatbot-reasoning-select-${model.id}`}
                                    className="text-xs text-gray-600"
                                  >
                                    {t('manage.resources.reasoningEffort')}
                                  </label>
                                  <Select
                                    id={`chatbot-reasoning-select-${model.id}`}
                                    data={{
                                      cy: `chatbot-reasoning-${model.id}`,
                                    }}
                                    value={selectedEffort}
                                    disabled={
                                      isSaving || !modelSettingsEditable
                                    }
                                    items={supportedEfforts.map((effort) => ({
                                      value: effort,
                                      label: effort,
                                    }))}
                                    onChange={(effort) =>
                                      handleReasoningEffortChange(
                                        model.id,
                                        effort
                                      )
                                    }
                                  />
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {supportedEfforts.map((effort) => {
                                    const checked =
                                      configuredEfforts.includes(effort)
                                    const canToggleOff =
                                      configuredEfforts.length > 1
                                    return (
                                      <div
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
                                        <Checkbox
                                          checked={checked}
                                          disabled={
                                            isSaving ||
                                            !modelSettingsEditable ||
                                            (checked && !canToggleOff)
                                          }
                                          aria-label={`${model.name}: ${effort}`}
                                          data={{
                                            cy: `chatbot-reasoning-${model.id}-${effort}`,
                                          }}
                                          onCheck={() =>
                                            handleReasoningEffortToggle(
                                              model.id,
                                              effort,
                                              !checked
                                            )
                                          }
                                          label={<span>{effort}</span>}
                                        />
                                      </div>
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
                {modelSelectionEnabled
                  ? allowedModelIds
                      .map(
                        (modelId) =>
                          modelRegistry.find((model) => model.id === modelId)
                            ?.name ?? modelId
                      )
                      .join(', ')
                  : (modelRegistry.find((model) => model.id === fixedModelId)
                      ?.name ?? fixedModelId)}
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
