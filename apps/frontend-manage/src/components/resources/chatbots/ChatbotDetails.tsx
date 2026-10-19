import { useMutation, useQuery } from '@apollo/client'
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import {
  ChatbotStatus,
  type ChatModelCapability,
  ChatUsageClass,
  CreditResetPeriod,
  GetChatAccountUsageDocument,
  MSaveChatbotRevisionDocument,
  QGetCatalystRequestAccessDocument,
  QGetChatbotsInfoWithKnowledgeBasesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Checkbox,
  H3,
  H4,
  Modal,
  Select,
  Switch,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import type { FormikProps, FormikValues } from 'formik'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'
import ChatbotAuthoring, {
  getCustomModeFormValues,
  getStandardModeFormValues,
} from './ChatbotAuthoring'
import { getSuggestedDisclaimer } from './ChatbotCreateModal'
import ChatbotCreditPolicy from './ChatbotCreditPolicy'
import ChatbotDisclaimerPreview from './ChatbotDisclaimerPreview'
import ChatbotKnowledgeBaseSetup from './ChatbotKnowledgeBaseSetup'
import ChatbotResponseExampleReview from './ChatbotResponseExampleReview'
import ChatbotSetupSection from './ChatbotSetupSection'
import ChatbotWorkspaceNavigation from './ChatbotWorkspaceNavigation'
import {
  getChatbotMutationErrorKey,
  isChatbotRevisionConflict,
} from './chatbotErrorMessages'
import { canUseChatbotOwnerPreview } from './chatbotOwnerPreviewAccess'
import { buildChatbotOwnerPreviewUrl } from './chatbotOwnerPreviewUrl'
import {
  ChatbotRevisionConflictNotice,
  ChatbotRevisionStatusNotice,
  type ChatbotRevisionValues,
  getChatbotRevisionValues,
  getChatbotRevisionVersion,
  isChatbotRevisionEditable,
  isChatbotRevisionPending,
  type RevisionChatbot,
  useChatbotRevisionReload,
} from './chatbotRevision'
import {
  type ChatbotSetupSectionId,
  type ChatbotSetupSectionStatus,
  isDefaultCreditPolicy,
  isDefaultGraphPolicy,
  isDefaultModelPolicy,
  isDefaultModes,
  isStudentInformationInvalid,
  isSuggestedStudentInformation,
  resolveSectionStatus,
  type StudentInformationValues,
  sectionBlocksRequest,
} from './chatbotSetupStatus'
import { getChatbotStatusTranslationKey } from './chatbotStatus'
import {
  type ChatbotNavigationState,
  type ChatbotSetupStep,
  type ChatbotWorkspaceView,
  getSetupLinkTarget,
  isSectionSetup,
} from './chatbotWorkspace'

type ChatbotModelPolicy = Pick<
  ChatbotRevisionValues,
  'modelSelection' | 'allowedModelIds' | 'allowedReasoningEffortsByModel'
>
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
  chatbot: ChatbotModelPolicy,
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
  chatbot: ChatbotModelPolicy,
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
  chatbot: ChatbotModelPolicy,
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

// Ordinary lecturers rarely change these settings, so they open on demand;
// advanced management shows them in place. The content mounts on first open,
// so its queries do not run for lecturers who never open the section, and
// stays mounted afterwards so closing the section keeps unsaved edits.
function ChatbotAdvancedSettings({
  advancedManagement,
  cy,
  children,
}: {
  advancedManagement: boolean
  cy: string
  children: ReactNode
}) {
  const t = useTranslations()
  const [opened, setOpened] = useState(false)
  if (advancedManagement) return <>{children}</>
  return (
    <details
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      data-cy={cy}
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true)
      }}
    >
      <summary className="cursor-pointer select-none" data-cy={`${cy}-trigger`}>
        <span className="font-medium text-gray-900">
          {t('manage.resources.chatbotAdvancedSettingsTitle')}
        </span>
        <span className="block text-sm text-gray-600">
          {t('manage.resources.chatbotAdvancedSettingsDescription')}
        </span>
      </summary>
      {opened ? <div className="mt-4 space-y-6">{children}</div> : null}
    </details>
  )
}

function ChatbotDetails({
  chatbot,
  modelRegistry,
  loading,
  advancedManagement,
  view: requestedView,
  step,
  onNavigate,
  onNavigationStateChange,
  publishingAuthorized,
  publishingAuthorizationLoading,
  publishingAuthorizationError,
}: {
  chatbot?: RevisionChatbot
  modelRegistry: ChatModelCapability[]
  loading: boolean
  advancedManagement: boolean
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
  // Usage holds operational quota settings that only advanced management
  // exposes; older links to it fall back to the overview.
  // A draft or rejected chatbot is set up on one page of sections without
  // tabs, so it has no workspace view.
  const singlePageSetup = chatbot ? isSectionSetup(chatbot) : false
  const view: ChatbotWorkspaceView | undefined = singlePageSetup
    ? undefined
    : !advancedManagement && requestedView === 'usage'
      ? 'overview'
      : requestedView
  const graphRetrievalAvailable = useFeatureFlag('chatbot-graphrag')
  const responseExamplesEnabled = useFeatureFlag('chatbot-response-examples')
  const { locale } = useRouter()
  const { data: scopeData } = useQuery(QGetCatalystRequestAccessDocument)
  // Only the owner edits a chatbot, so the viewer's own entitlement decides
  // which models its participants can actually use.
  const { data: accountUsageData } = useQuery(GetChatAccountUsageDocument)
  // Drafts can be prepared without AI access, while advanced models still
  // require an advanced subscription and a cost center.
  // Delegated logins cannot read the overview; the server's save check stays
  // authoritative, so an unknown entitlement leaves every model enabled.
  const accountUsage = accountUsageData?.getChatAccountUsage
  const advancedModelsEntitled = !accountUsage
    ? true
    : accountUsage.authorized
      ? accountUsage.advancedModelUsage.entitled
      : accountUsage.advancedModelConfigurationEntitled
  // Models in the saved revision stay selectable, as the server accepts them.
  const savedModelIds = useMemo(
    () => (chatbot ? getChatbotRevisionValues(chatbot).allowedModelIds : []),
    [chatbot]
  )
  const isModelUnavailable = (model: ChatModelCapability) =>
    model.usageClass === ChatUsageClass.Advanced && !advancedModelsEntitled
  const isModelLocked = (model: ChatModelCapability) =>
    isModelUnavailable(model) && !savedModelIds.includes(model.id)
  const [saveRevision, { loading: isSaving }] = useMutation(
    MSaveChatbotRevisionDocument
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [revisionConflict, setRevisionConflict] = useState(false)
  const revisionConflictRef = useRef(false)
  const modelSettingsDirtyRef = useRef(false)
  const modelSettingsChatbotIdRef = useRef<string | undefined>(undefined)
  const { loading: revisionReloading, reload: reloadRevision } =
    useChatbotRevisionReload()
  const [modelSelectionEnabled, setModelSelectionEnabled] = useState(false)
  const [fixedModelId, setFixedModelId] = useState('')
  const [allowedModelIds, setAllowedModelIds] = useState<string[]>([])
  const [reasoningConfig, setReasoningConfig] = useState<ReasoningConfigState>(
    {}
  )
  const [authoringNavigationState, setAuthoringNavigationState] =
    useState<ChatbotNavigationState>({ dirty: false, pending: false })
  const [openSections, setOpenSections] = useState<ChatbotSetupSectionId[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)
  // The student information shown in the preview dialog, captured when it
  // opens so it includes unsaved edits.
  const [studentsPreview, setStudentsPreview] =
    useState<StudentInformationValues | null>(null)
  // The suggested student information in every interface language, so a
  // chatbot created in another course language still shows "Suggested".
  const [suggestedStudentInformation, setSuggestedStudentInformation] =
    useState<StudentInformationValues[]>([])
  // The section footers save and discard the embedded editors through their
  // forms.
  const basicsFormRef = useRef<FormikProps<FormikValues> | null>(null)
  const disclaimerFormRef = useRef<FormikProps<FormikValues> | null>(null)
  const modesFormRef = useRef<FormikProps<FormikValues> | null>(null)
  const customModesFormRef = useRef<FormikProps<FormikValues> | null>(null)
  const creditFormRef = useRef<FormikProps<FormikValues> | null>(null)
  const [basicsNavigationState, setBasicsNavigationState] =
    useState<ChatbotNavigationState>({ dirty: false, pending: false })
  const [disclaimerNavigationState, setDisclaimerNavigationState] =
    useState<ChatbotNavigationState>({ dirty: false, pending: false })
  const [behaviorNavigationState, setBehaviorNavigationState] =
    useState<ChatbotNavigationState>({ dirty: false, pending: false })
  const [creditNavigationState, setCreditNavigationState] =
    useState<ChatbotNavigationState>({ dirty: false, pending: false })
  // Staged through the chatbot revision and promoted on approval.
  const [knowledgeGraphPolicy, setKnowledgeGraphPolicy] = useState<{
    visible: boolean
    retrievalEnabled: boolean
  }>({ visible: true, retrievalEnabled: false })
  const [knowledgeGraphSaveSuccess, setKnowledgeGraphSaveSuccess] =
    useState(false)
  const [knowledgeGraphSaveError, setKnowledgeGraphSaveError] = useState<
    string | null
  >(null)
  const knowledgeGraphPolicyChatbotIdRef = useRef<string | undefined>(undefined)

  const knowledgeGraphDirty = useMemo(() => {
    if (!chatbot) return false
    const revisionValues = getChatbotRevisionValues(chatbot)
    return (
      knowledgeGraphPolicy.visible !== revisionValues.knowledgeGraphVisible ||
      knowledgeGraphPolicy.retrievalEnabled !==
        revisionValues.knowledgeGraphRetrievalEnabled
    )
  }, [chatbot, knowledgeGraphPolicy])

  useEffect(() => {
    if (!chatbot) return
    // Seed once per chatbot; refetches keep in-progress values.
    if (knowledgeGraphPolicyChatbotIdRef.current === chatbot.id) return

    knowledgeGraphPolicyChatbotIdRef.current = chatbot.id
    const revisionValues = getChatbotRevisionValues(chatbot)
    setKnowledgeGraphPolicy({
      visible: revisionValues.knowledgeGraphVisible,
      retrievalEnabled: revisionValues.knowledgeGraphRetrievalEnabled,
    })
    setKnowledgeGraphSaveSuccess(false)
    setKnowledgeGraphSaveError(null)
  }, [chatbot])

  const markRevisionConflict = () => {
    revisionConflictRef.current = true
    setRevisionConflict(true)
  }
  const clearRevisionConflict = () => {
    revisionConflictRef.current = false
    setRevisionConflict(false)
  }

  const reloadAfterConflict = async () => {
    await reloadRevision()
    revisionConflictRef.current = true
    setRevisionConflict(true)
  }

  const reasoningModels = useMemo(
    () => modelRegistry.filter((model) => model.supportsReasoning),
    [modelRegistry]
  )

  const selectedReasoningModels = reasoningModels.filter((model) =>
    modelSelectionEnabled
      ? allowedModelIds.includes(model.id)
      : model.id === fixedModelId
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

  const resetModelSettings = useCallback(() => {
    if (!chatbot) return

    const revisionValues = getChatbotRevisionValues(chatbot)
    setModelSelectionEnabled(revisionValues.modelSelection)
    setFixedModelId(getDefaultFixedModelId(revisionValues, modelRegistry))
    setAllowedModelIds(
      getInitialSelectedModelIds(revisionValues, modelRegistry)
    )
    setReasoningConfig(
      buildReasoningConfigState(
        revisionValues,
        modelRegistry,
        getDefaultFixedModelId(revisionValues, modelRegistry)
      )
    )
    setSaveError(null)
    setSaveSuccess(false)
  }, [chatbot, modelRegistry])

  useEffect(() => {
    if (!chatbot) return

    const chatbotChanged = modelSettingsChatbotIdRef.current !== chatbot.id
    if (chatbotChanged) {
      modelSettingsChatbotIdRef.current = chatbot.id
      modelSettingsDirtyRef.current = false
      revisionConflictRef.current = false
      setRevisionConflict(false)
    }

    if (revisionConflictRef.current || modelSettingsDirtyRef.current) return

    resetModelSettings()
  }, [chatbot, resetModelSettings])

  useEffect(() => {
    if (!singlePageSetup) return
    let active = true
    void Promise.all(['en', 'de'].map(getSuggestedDisclaimer)).then(
      (suggestions) => {
        if (!active) return
        setSuggestedStudentInformation(
          suggestions.map(({ disclaimerTitle, disclaimerIntroText }) => ({
            title: disclaimerTitle,
            introText: disclaimerIntroText,
          }))
        )
      }
    )
    return () => {
      active = false
    }
  }, [singlePageSetup])

  const scrollToSetupElement = useCallback((elementId: string) => {
    window.requestAnimationFrame(() => {
      document
        .getElementById(elementId)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const openSetupSection = useCallback(
    (section: ChatbotSetupSectionId) => {
      setOpenSections((current) =>
        current.includes(section) ? current : [...current, section]
      )
      scrollToSetupElement(`chatbot-section-${section}`)
    },
    [scrollToSetupElement]
  )

  const setSetupSectionOpen = (
    section: ChatbotSetupSectionId,
    open: boolean
  ) => {
    setOpenSections((current) =>
      open
        ? current.includes(section)
          ? current
          : [...current, section]
        : current.filter((id) => id !== section)
    )
  }

  // A link into a former workspace view opens its section once per chatbot
  // and link; every other section starts closed.
  const setupLinkTarget = singlePageSetup
    ? getSetupLinkTarget({ view: requestedView, step })
    : undefined
  const setupLinkKey = singlePageSetup
    ? `${chatbot?.id}:${setupLinkTarget ?? ''}`
    : undefined
  useEffect(() => {
    if (!setupLinkKey) return
    setDetailsOpen(setupLinkTarget === 'details')
    setStudentsPreview(null)
    if (setupLinkTarget === 'request') {
      setOpenSections([])
      scrollToSetupElement('chatbot-section-request')
    } else if (setupLinkTarget && setupLinkTarget !== 'details') {
      setOpenSections([setupLinkTarget])
      scrollToSetupElement(`chatbot-section-${setupLinkTarget}`)
    } else {
      setOpenSections([])
    }
  }, [scrollToSetupElement, setupLinkKey, setupLinkTarget])

  const modelSettingsDirty = useMemo(() => {
    if (!chatbot) return false

    const revisionValues = getChatbotRevisionValues(chatbot)
    const initialSelectedModelIds = getInitialSelectedModelIds(
      revisionValues,
      modelRegistry
    )
    const currentSelectedModelIds = modelSelectionEnabled
      ? allowedModelIds
      : fixedModelId
        ? [fixedModelId]
        : []
    const initialReasoningConfig = buildReasoningConfigState(
      revisionValues,
      modelRegistry,
      getDefaultFixedModelId(revisionValues, modelRegistry)
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
      modelSelectionEnabled !== revisionValues.modelSelection ||
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
    modelSettingsDirtyRef.current = modelSettingsDirty
  }, [modelSettingsDirty])

  const viewNavigationState = useMemo<ChatbotNavigationState>(() => {
    if (view === undefined) {
      const editorStates = [
        basicsNavigationState,
        disclaimerNavigationState,
        behaviorNavigationState,
        creditNavigationState,
      ]
      return {
        dirty:
          modelSettingsDirty ||
          knowledgeGraphDirty ||
          authoringNavigationState.dirty ||
          editorStates.some(({ dirty }) => dirty),
        pending:
          isSaving ||
          authoringNavigationState.pending ||
          editorStates.some(({ pending }) => pending),
      }
    }

    if (view === 'behavior') {
      return {
        dirty:
          modelSettingsDirty ||
          authoringNavigationState.dirty ||
          knowledgeGraphDirty,
        pending: isSaving || authoringNavigationState.pending,
      }
    }

    if (view === 'knowledge') {
      return { dirty: knowledgeGraphDirty, pending: isSaving }
    }

    if (view === 'overview' || view === 'usage') {
      return {
        dirty: authoringNavigationState.dirty || creditNavigationState.dirty,
        pending:
          authoringNavigationState.pending || creditNavigationState.pending,
      }
    }

    if (view === 'disclaimer') {
      return authoringNavigationState
    }

    return { dirty: false, pending: false }
  }, [
    authoringNavigationState,
    basicsNavigationState,
    behaviorNavigationState,
    creditNavigationState,
    disclaimerNavigationState,
    isSaving,
    knowledgeGraphDirty,
    modelSettingsDirty,
    view,
  ])

  useEffect(() => {
    onNavigationStateChange(viewNavigationState)
  }, [onNavigationStateChange, viewNavigationState])

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

  const enabledKnowledgeBases = chatbot.enabledKnowledgeBases ?? []

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
  const ownerPreviewUrl = buildChatbotOwnerPreviewUrl({
    chatbotId: chatbot.id,
    chatUrl: process.env.NEXT_PUBLIC_CHAT_URL,
  })
  const ownerPreviewPending = viewNavigationState.pending
  const ownerPreviewDirty = viewNavigationState.dirty
  const handleOwnerPreviewClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (ownerPreviewPending) {
      event.preventDefault()
      window.alert(t('manage.resources.chatbotNavigationPending'))
      return
    }

    if (
      ownerPreviewDirty &&
      !window.confirm(t('manage.resources.chatbotPreviewUnsavedConfirmation'))
    ) {
      event.preventDefault()
    }
  }
  const chatbotStatusLabel = t(getChatbotStatusTranslationKey(chatbot.status))
  const modelSettingsEditable = isChatbotRevisionEditable(chatbot)
  const revisionPending = isChatbotRevisionPending(chatbot)
  const showOverviewReadOnlyDetails = overviewReadOnlyStatuses.includes(
    chatbot.status
  )

  const handleAllowedModelToggle = (modelId: string, checked: boolean) => {
    setSaveError(null)
    setSaveSuccess(false)
    clearRevisionConflict()
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
    clearRevisionConflict()
    setFixedModelId(modelId)
  }

  const handleModelSelectionChange = (checked: boolean) => {
    setSaveError(null)
    setSaveSuccess(false)
    clearRevisionConflict()
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
    clearRevisionConflict()
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
    clearRevisionConflict()
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
    clearRevisionConflict()

    const normalizedAllowedModelIds = modelSelectionEnabled
      ? Array.from(new Set(allowedModelIds)).sort((left, right) => {
          if (left < right) return -1
          if (left > right) return 1
          return 0
        })
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
      await saveRevision({
        variables: {
          chatbotId: chatbot.id,
          expectedRevisionVersion: getChatbotRevisionVersion(chatbot),
          input: {
            modelPolicy: {
              modelSelection: modelSelectionEnabled,
              allowedModelIds: normalizedAllowedModelIds,
              allowedReasoningEffortsByModel: normalizedReasoningConfig,
            },
          },
        },
        refetchQueries: [{ query: QGetChatbotsInfoWithKnowledgeBasesDocument }],
        awaitRefetchQueries: true,
      })

      setSaveSuccess(true)
      return true
    } catch (error) {
      if (isChatbotRevisionConflict(error)) markRevisionConflict()
      setSaveError(t(getChatbotMutationErrorKey(error, 'metadata')))
      return false
    }
  }

  const handleSaveKnowledgeGraphPolicy = async () => {
    setKnowledgeGraphSaveError(null)
    setKnowledgeGraphSaveSuccess(false)
    clearRevisionConflict()

    try {
      await saveRevision({
        variables: {
          chatbotId: chatbot.id,
          expectedRevisionVersion: getChatbotRevisionVersion(chatbot),
          input: {
            knowledgeGraphPolicy: {
              visible: knowledgeGraphPolicy.visible,
              retrievalEnabled: knowledgeGraphPolicy.retrievalEnabled,
            },
          },
        },
        refetchQueries: [{ query: QGetChatbotsInfoWithKnowledgeBasesDocument }],
        awaitRefetchQueries: true,
      })

      setKnowledgeGraphSaveSuccess(true)
      return true
    } catch (error) {
      if (isChatbotRevisionConflict(error)) markRevisionConflict()
      setKnowledgeGraphSaveError(
        t(getChatbotMutationErrorKey(error, 'metadata'))
      )
      return false
    }
  }

  const resetKnowledgeGraphPolicy = () => {
    const revisionValues = getChatbotRevisionValues(chatbot)
    setKnowledgeGraphPolicy({
      visible: revisionValues.knowledgeGraphVisible,
      retrievalEnabled: revisionValues.knowledgeGraphRetrievalEnabled,
    })
    setKnowledgeGraphSaveSuccess(false)
    setKnowledgeGraphSaveError(null)
  }

  // These settings are shown in place when advanced management is enabled.
  // For other lecturers they stay available in collapsed sections.
  // Model routing and reasoning-effort tuning require
  // understanding provider capabilities and cost tradeoffs
  // that fall outside ordinary lecturing.
  // On the setup page the section supplies the title, the frame and Save.
  const modelSettings = (
    <div>
      {singlePageSetup ? null : (
        <div className="mb-2 text-sm font-medium text-gray-700">
          {t('manage.resources.chatbotModelSettings')}
        </div>
      )}
      <div
        className={
          singlePageSetup
            ? 'space-y-4'
            : 'space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm'
        }
      >
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
              disabled={isSaving || !modelSettingsEditable || revisionPending}
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
              disabled={isSaving || !modelSettingsEditable || revisionPending}
              items={modelRegistry.map((model) => ({
                value: model.id,
                label: model.name,
                tooltip: model.description,
                disabled: isModelLocked(model) && model.id !== fixedModelId,
              }))}
              onChange={handleFixedModelChange}
            />
            {modelRegistry.some(
              (model) => model.id === fixedModelId && isModelUnavailable(model)
            ) ? (
              <p
                className="text-xs text-amber-700"
                data-cy="chatbot-fixed-model-unavailable"
              >
                {t('manage.resources.modelUnavailableSelected')}
              </p>
            ) : modelRegistry.some(isModelUnavailable) ? (
              <p className="text-xs text-gray-500">
                {t('manage.resources.modelUnavailableHint')}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 border-t pt-4">
            <div className="text-sm font-medium text-gray-700">
              {t('manage.resources.allowedModels')}
            </div>
            <p className="text-xs text-gray-500">
              {t('manage.resources.modelSelectionParticipantDescription')}
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {modelRegistry.map((model) => {
                const checked = allowedModelIds.includes(model.id)
                const isLastSelected = checked && allowedModelIds.length === 1
                const unavailable = isModelUnavailable(model)
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
                        revisionPending ||
                        isLastSelected ||
                        (isModelLocked(model) && !checked)
                      }
                      aria-label={model.name}
                      data={{ cy: `chatbot-model-${model.id}` }}
                      onCheck={() =>
                        handleAllowedModelToggle(model.id, !checked)
                      }
                      label={
                        <span className="flex flex-col">
                          <span className="font-medium">{model.name}</span>
                          <span className="text-xs text-gray-500">
                            {model.description}
                          </span>
                          {unavailable ? (
                            <span
                              className={twMerge(
                                'text-xs',
                                checked ? 'text-amber-700' : 'text-gray-500'
                              )}
                              data-cy={`chatbot-model-unavailable-${model.id}`}
                            >
                              {t(
                                checked
                                  ? 'manage.resources.modelUnavailableSelected'
                                  : 'manage.resources.modelUnavailableHint'
                              )}
                            </span>
                          ) : null}
                        </span>
                      }
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {selectedReasoningModels.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <div className="text-sm font-medium text-gray-700">
              {t('manage.resources.reasoningEffortsByModel')}
            </div>

            <div className="space-y-3">
              {selectedReasoningModels.map((model) => {
                const supportedEfforts = model.supportedReasoningEfforts
                const configuredEfforts = orderEffortsBy(
                  reasoningConfig[model.id] ?? supportedEfforts,
                  supportedEfforts
                )
                const selectedEffort =
                  !modelSelectionEnabled && configuredEfforts.includes('medium')
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
                            isSaving ||
                            !modelSettingsEditable ||
                            revisionPending
                          }
                          items={supportedEfforts.map((effort) => ({
                            value: effort,
                            label: effort,
                          }))}
                          onChange={(effort) =>
                            handleReasoningEffortChange(model.id, effort)
                          }
                        />
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {supportedEfforts.map((effort) => {
                          const checked = configuredEfforts.includes(effort)
                          const canToggleOff = configuredEfforts.length > 1
                          return (
                            <div
                              key={`reasoning-effort-${model.id}-${effort}`}
                              className={twMerge(
                                'flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
                                checked
                                  ? 'border-blue-300 bg-blue-50 text-blue-900'
                                  : 'border-gray-300 text-gray-700',
                                !checked && !canToggleOff ? 'opacity-60' : ''
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                disabled={
                                  isSaving ||
                                  !modelSettingsEditable ||
                                  revisionPending ||
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

        <div
          hidden={singlePageSetup}
          className="flex items-center gap-3 border-t pt-4"
        >
          <Button
            onClick={handleSaveModelSettings}
            disabled={isSaving || !modelSettingsEditable || revisionPending}
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

        {revisionConflict ? (
          <ChatbotRevisionConflictNotice
            message={t('manage.resources.chatbotRevisionConflict')}
            onReload={() => void reloadAfterConflict()}
            reloading={revisionReloading}
            testId="chatbot-revision-reload-model-policy"
          />
        ) : null}

        {saveError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {saveError}
          </div>
        )}
      </div>
    </div>
  )
  const knowledgeAdvancedSettings = (
    <>
      <div
        hidden={singlePageSetup}
        className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4"
      >
        <p className="text-sm text-gray-600">
          {t('manage.resources.chatbotKnowledgeManagementLink')}
        </p>
        <Link
          href="/resources/knowledgeBases"
          className="text-primary-100 hover:underline"
          data-cy="chatbot-knowledge-base-management"
        >
          {t('manage.resources.knowledgeBase')}
        </Link>
      </div>
      {/* Concept-map visibility and graph-retrieval tuning assume the reader understands how the knowledge graph is built and queried, which an ordinary lecturer does not need to reason about to run a chatbot. */}
      <div
        className={
          singlePageSetup
            ? 'space-y-4'
            : 'space-y-4 border-t border-gray-200 pt-4'
        }
        data-cy="chatbot-knowledge-graph-policy"
      >
        <div>
          {singlePageSetup ? null : (
            <div className="text-sm font-medium text-gray-700">
              {t('manage.resources.knowledgeGraphPolicy')}
            </div>
          )}
          <p className="text-xs text-gray-500">
            {t('manage.resources.knowledgeGraphPolicyDescription')}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="chatbot-knowledge-graph-visible-switch"
              className="text-sm font-medium text-gray-700"
            >
              {t('manage.resources.knowledgeGraphVisible')}
            </label>
            <Switch
              id="chatbot-knowledge-graph-visible-switch"
              checked={knowledgeGraphPolicy.visible}
              disabled={isSaving || !modelSettingsEditable || revisionPending}
              onCheckedChange={(checked) => {
                setKnowledgeGraphSaveSuccess(false)
                setKnowledgeGraphSaveError(null)
                clearRevisionConflict()
                setKnowledgeGraphPolicy((current) => ({
                  ...current,
                  visible: checked,
                }))
              }}
              data={{ cy: 'chatbot-knowledge-graph-visible-switch' }}
            />
          </div>
          <div className="text-xs text-gray-500">
            {knowledgeGraphPolicy.visible
              ? t('manage.resources.knowledgeGraphVisibleEnabledDescription')
              : t('manage.resources.knowledgeGraphVisibleDisabledDescription')}
          </div>
        </div>

        {graphRetrievalAvailable && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="chatbot-knowledge-graph-retrieval-switch"
                className="text-sm font-medium text-gray-700"
              >
                {t('manage.resources.knowledgeGraphRetrieval')}
              </label>
              <Switch
                id="chatbot-knowledge-graph-retrieval-switch"
                checked={knowledgeGraphPolicy.retrievalEnabled}
                disabled={isSaving || !modelSettingsEditable || revisionPending}
                onCheckedChange={(checked) => {
                  setKnowledgeGraphSaveSuccess(false)
                  setKnowledgeGraphSaveError(null)
                  clearRevisionConflict()
                  setKnowledgeGraphPolicy((current) => ({
                    ...current,
                    retrievalEnabled: checked,
                  }))
                }}
                data={{
                  cy: 'chatbot-knowledge-graph-retrieval-switch',
                }}
              />
            </div>
            <div className="text-xs text-gray-500">
              {t('manage.resources.knowledgeGraphRetrievalDescription')}
            </div>
          </div>
        )}

        <div
          hidden={singlePageSetup}
          className="flex flex-wrap items-center gap-3"
        >
          <Button
            onClick={handleSaveKnowledgeGraphPolicy}
            disabled={
              isSaving ||
              !modelSettingsEditable ||
              revisionPending ||
              !knowledgeGraphDirty
            }
            data={{ cy: 'chatbot-knowledge-graph-save' }}
          >
            <Button.Label>
              {isSaving
                ? t('manage.resources.chatbotModelSettingsSaving')
                : t('manage.resources.knowledgeGraphSave')}
            </Button.Label>
          </Button>
          {knowledgeGraphSaveSuccess && (
            <span className="text-xs text-green-700">
              {t('manage.resources.knowledgeGraphSaveSuccess')}
            </span>
          )}
        </div>

        {revisionConflict ? (
          <ChatbotRevisionConflictNotice
            message={t('manage.resources.chatbotRevisionConflict')}
            onReload={() => void reloadAfterConflict()}
            reloading={revisionReloading}
            testId="chatbot-revision-reload-knowledge-graph"
          />
        ) : null}

        {knowledgeGraphSaveError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {knowledgeGraphSaveError}
          </div>
        )}
      </div>
      {/* Curated response examples train reviewers to judge answer quality against the chatbot's own knowledge base, a task an ordinary lecturer does not perform. */}
      {responseExamplesEnabled ? (
        <Accordion
          type="single"
          collapsible
          className="border-t border-gray-200 pt-4"
          data-cy="chatbot-knowledge-secondary"
        >
          <AccordionItem
            value="response-examples"
            className="rounded-lg border border-gray-200 px-4"
            data-cy="chatbot-response-examples-item"
          >
            <AccordionTrigger
              className="py-3 hover:no-underline"
              data-cy="chatbot-response-examples-trigger"
            >
              <span className="flex flex-col gap-1 text-left">
                <span>{t('manage.resources.responseExamples')}</span>
                <span className="text-sm font-normal text-gray-600">
                  {t('manage.resources.responseExamplesDescription')}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent forceMount>
              <ChatbotResponseExampleReview
                key={chatbot.id}
                chatbotId={chatbot.id}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </>
  )
  const usageSettings = (
    <div className="space-y-6" data-cy="chatbot-usage">
      {/* A draft has never been live, so only the editor below shows its credit policy. */}
      {singlePageSetup ? null : (
        <div>
          <div className="mb-2 text-sm font-medium text-gray-700">
            {t('manage.resources.credits')}
          </div>
          <UserNotification data={{ cy: 'chatbot-live-credit-policy' }}>
            <span className="font-medium">
              {t('manage.resources.chatbotOwnerPreviewLive')}
            </span>{' '}
            {t('manage.resources.chatbotOwnerPreviewLiveDescription')}
          </UserNotification>
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
      )}

      {/* The credit editor changes the live participant-facing quota, an operational lever an ordinary lecturer should not tune. */}
      <>
        <ChatbotCreditPolicy
          key={chatbot.id}
          chatbot={chatbot}
          publicationPending={false}
          onNavigationStateChange={setCreditNavigationState}
          onRevisionConflict={markRevisionConflict}
        />
        {revisionConflict ? (
          <ChatbotRevisionConflictNotice
            message={t('manage.resources.chatbotRevisionConflict')}
            onReload={() => void reloadAfterConflict()}
            reloading={revisionReloading}
            testId="chatbot-revision-reload-credits"
          />
        ) : null}
      </>

      {/* Thread/message counters and reset history are usage analytics for tuning credit policy, not day-to-day teaching. */}
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
                <td className="px-4 py-2 text-gray-900">{lastActivityLabel}</td>
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
                <td className="px-4 py-2 text-gray-900">{lastResetLabel}</td>
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
    </div>
  )

  // Each setup section reports a status and a short summary of its saved
  // values, so a closed section shows what is done and what needs work.
  const savedValues = getChatbotRevisionValues(chatbot)
  const connectedKnowledgeBase = enabledKnowledgeBases[0]
  const formatList = (items: string[]) =>
    new Intl.ListFormat(locale ?? 'en', {
      style: 'long',
      type: 'conjunction',
    }).format(items)
  const getModelName = (modelId: string) =>
    modelRegistry.find((model) => model.id === modelId)?.name ?? modelId

  const materialsReadiness = connectedKnowledgeBase?.materialsReadiness
  // Failed resources never block a request, but the lecturer should notice.
  const materialsStatus = resolveSectionStatus({
    warning:
      !connectedKnowledgeBase ||
      (materialsReadiness?.failedResourceCount ?? 0) > 0,
  })
  const materialsSummary = connectedKnowledgeBase
    ? [
        t('manage.resources.chatbotSummaryMaterialsConnected', {
          name: connectedKnowledgeBase.name,
        }),
        materialsReadiness
          ? t('manage.resources.chatbotSummaryMaterialsReadiness', {
              total: materialsReadiness.visibleResourceCount,
              ready: materialsReadiness.servingResourceCount,
              failed: materialsReadiness.failedResourceCount,
            })
          : null,
      ]
        .filter(Boolean)
        .join(' ')
    : t('manage.resources.chatbotSummaryMaterialsNone')

  // A chatbot created before the suggestion existed has no stored student
  // information; its editor then starts from the suggested text, which still
  // has to be saved before the chatbot can be requested.
  const studentInformationStored =
    savedValues.disclaimerTitle != null ||
    Boolean(chatbot.disclaimerSummary?.id)
  const studentInformation = {
    title: savedValues.disclaimerTitle,
    introText: savedValues.disclaimerIntroText,
  }
  const studentInformationInvalid =
    isStudentInformationInvalid(studentInformation)
  const studentInformationSuggested =
    studentInformationStored &&
    isSuggestedStudentInformation(
      studentInformation,
      suggestedStudentInformation
    )
  const studentsStatus = resolveSectionStatus({
    unsaved: disclaimerNavigationState.dirty,
    invalid: studentInformationInvalid,
    suggested: studentInformationSuggested,
  })
  const studentsSummary = !studentInformationStored
    ? t('manage.resources.chatbotSummaryStudentsNotSaved')
    : studentInformationInvalid
      ? t('manage.resources.chatbotSummaryStudentsInvalid')
      : [
          t('manage.resources.chatbotSummaryStudents', {
            title: savedValues.disclaimerTitle ?? '',
          }),
          studentInformationSuggested
            ? t('manage.resources.chatbotSummaryStudentsSuggested')
            : null,
        ]
          .filter(Boolean)
          .join(' ')
  const openStudentsPreview = () => {
    const formValues = disclaimerFormRef.current?.values
    setStudentsPreview({
      title:
        (formValues?.title as string | undefined) ??
        (studentInformationStored
          ? (savedValues.disclaimerTitle ?? '')
          : t('manage.resources.chatbotDisclaimerSuggestedTitle')),
      introText:
        (formValues?.introText as string | undefined) ??
        (studentInformationStored
          ? (savedValues.disclaimerIntroText ?? '')
          : t('manage.resources.chatbotDisclaimerSuggestedIntro')),
    })
  }

  const savedModes = getStandardModeFormValues(chatbot)
  const savedCustomModeCount = getCustomModeFormValues(chatbot).modes.length
  const modesStatus = resolveSectionStatus({
    unsaved: behaviorNavigationState.dirty,
    isDefault: isDefaultModes({
      ...savedModes,
      customModeCount: savedCustomModeCount,
    }),
  })
  const enabledModeNames = [
    savedModes.tutorEnabled ? t('manage.resources.chatbotModeTutor') : null,
    savedModes.explainerEnabled
      ? t('manage.resources.chatbotModeExplainer')
      : null,
    savedModes.quizzerEnabled ? t('manage.resources.chatbotModeQuizzer') : null,
  ].filter((name): name is string => name !== null)
  const modesSummary = [
    enabledModeNames.length > 0
      ? t('manage.resources.chatbotSummaryModesOn', {
          modes: formatList(enabledModeNames),
          count: enabledModeNames.length,
        })
      : t('manage.resources.chatbotSummaryModesNone'),
    // Quizzer only appears to students once a knowledge base is connected.
    savedModes.quizzerEnabled && !connectedKnowledgeBase
      ? t('manage.resources.chatbotSummaryModesQuizzerNeedsKb')
      : t('manage.resources.chatbotSummaryModesExtras', {
          framing: savedModes.scopeNote.trim() ? 'set' : 'none',
          custom: savedCustomModeCount,
        }),
  ].join(' ')

  // Mirrors getNewChatbotModelId on the server: a new chatbot uses GPT-6 Luna
  // when it is a base model, and Auto otherwise.
  const defaultModelId =
    modelRegistry.find(
      (model) =>
        model.id === 'gpt-6-luna' && model.usageClass === ChatUsageClass.Base
    )?.id ?? 'auto'
  const modelStatus = resolveSectionStatus({
    unsaved: modelSettingsDirty,
    isDefault: isDefaultModelPolicy(
      {
        modelSelection: savedValues.modelSelection,
        allowedModelIds: savedValues.allowedModelIds,
        reasoningEffortsByModel: savedValues.allowedReasoningEffortsByModel,
      },
      defaultModelId
    ),
  })
  const savedFixedModelId = getDefaultFixedModelId(savedValues, modelRegistry)
  const savedFixedEffort = buildReasoningConfigState(
    savedValues,
    modelRegistry,
    savedFixedModelId
  )[savedFixedModelId]?.[0]
  const modelSummary = savedValues.modelSelection
    ? t('manage.resources.chatbotSummaryModelChoice', {
        models: formatList(
          getInitialSelectedModelIds(savedValues, modelRegistry).map(
            getModelName
          )
        ),
      })
    : [
        savedFixedEffort
          ? t('manage.resources.chatbotSummaryModelFixedReasoning', {
              model: getModelName(savedFixedModelId),
              effort: savedFixedEffort,
            })
          : t('manage.resources.chatbotSummaryModelFixed', {
              model: getModelName(savedFixedModelId),
            }),
        t('manage.resources.chatbotSummaryModelNoChoice'),
      ].join(' ')

  const usageStatus = resolveSectionStatus({
    unsaved: creditNavigationState.dirty,
    isDefault: isDefaultCreditPolicy(savedValues),
  })
  const usageLimitsSummary = [
    t('manage.resources.chatbotSummaryUsageInitial', {
      initial: savedValues.creditInitialCredits,
    }),
    t('manage.resources.chatbotSummaryUsageRefill', {
      period: savedValues.creditResetPeriod,
      amount: savedValues.creditResetAmount,
      max: savedValues.creditMaxCredits,
    }),
  ].join(' ')

  const graphStatus = resolveSectionStatus({
    unsaved: knowledgeGraphDirty,
    isDefault: isDefaultGraphPolicy(savedValues),
  })
  const graphSummary = [
    t('manage.resources.chatbotSummaryGraph', {
      visible: savedValues.knowledgeGraphVisible ? 'yes' : 'no',
    }),
    graphRetrievalAvailable
      ? t('manage.resources.chatbotSummaryGraphRetrieval', {
          enabled: savedValues.knowledgeGraphRetrievalEnabled ? 'yes' : 'no',
        })
      : null,
  ]
    .filter(Boolean)
    .join(' ')

  const sectionTitles: Record<ChatbotSetupSectionId, string> = {
    materials: t('manage.resources.chatbotSectionMaterials'),
    students: t('manage.resources.chatbotSectionStudents'),
    modes: t('manage.resources.chatbotSectionModes'),
    model: t('manage.resources.chatbotSectionModel'),
    usage: t('manage.resources.chatbotSectionUsage'),
    graph: t('manage.resources.chatbotSectionGraph'),
  }
  const sectionStatuses: [ChatbotSetupSectionId, ChatbotSetupSectionStatus][] =
    [
      ['materials', materialsStatus],
      ['students', studentsStatus],
      ['modes', modesStatus],
      ['model', modelStatus],
      ['usage', usageStatus],
      ['graph', graphStatus],
    ]
  const requestBlockers = sectionStatuses
    .filter(([, status]) => sectionBlocksRequest(status))
    .map(([id, status]) => ({
      id,
      label:
        status === 'unsaved'
          ? t('manage.resources.chatbotPublicationBlockerUnsaved', {
              section: sectionTitles[id],
            })
          : t('manage.resources.chatbotPublicationBlockerInvalid', {
              section: sectionTitles[id],
            }),
    }))
  const setupEditable = modelSettingsEditable && !revisionPending
  const closeSetupSection = (section: ChatbotSetupSectionId) =>
    setSetupSectionOpen(section, false)
  const courseNames = (chatbot.courses ?? []).map(({ name }) => name)

  // The setup page lists these identifiers last, as a closed section.
  const technicalDetails = (
    <details
      className={
        singlePageSetup
          ? 'rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-500'
          : 'mt-2 text-xs text-gray-500'
      }
      data-cy="chatbot-technical-details"
    >
      <summary
        className="cursor-pointer select-none font-medium text-gray-600"
        data-cy="chatbot-technical-details-trigger"
      >
        {t('manage.resources.chatbotTechnicalDetails')}
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
        <div>
          {t('manage.resources.chatbotTechnicalId')}:{' '}
          <span className="select-all">{chatbot.id}</span>
        </div>
        {chatbot.avatar && (
          <div className="flex max-w-full items-center gap-1">
            <span>{t('manage.resources.chatbotTechnicalAvatar')}:</span>
            <span className="max-w-[200px] truncate" title={chatbot.avatar}>
              {chatbot.avatar}
            </span>
          </div>
        )}
      </div>
    </details>
  )

  return (
    <div data-cy="chatbot-details">
      <div className="space-y-6">
        <div>
          <div className="flex flex-row flex-wrap items-start justify-between gap-4">
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
              {chatbot.status === ChatbotStatus.Rejected ? (
                <Badge
                  className="bg-amber-100 text-amber-900 hover:bg-amber-200"
                  data-cy="chatbot-changes-requested"
                >
                  {t('manage.resources.chatbotChangesRequested')}
                </Badge>
              ) : null}
              {singlePageSetup && setupEditable ? (
                <button
                  type="button"
                  className="text-primary-100 text-sm font-medium hover:underline"
                  onClick={() => setDetailsOpen(true)}
                  data-cy="chatbot-edit-details"
                >
                  {t('manage.resources.chatbotEditDetails')}
                </button>
              ) : null}
            </div>
            {canUseChatbotOwnerPreview(scopeData?.userScope) &&
              ownerPreviewUrl &&
              chatbot.status !== ChatbotStatus.Paused && (
                <div className="flex w-full min-w-0 flex-col items-stretch gap-1 sm:w-auto sm:items-end">
                  <a
                    href={ownerPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-primary-100 text-primary-100 hover:bg-primary-20 focus-visible:ring-primary-80 inline-flex min-h-10 w-full max-w-full items-center justify-center gap-2 whitespace-normal rounded-md border bg-white px-3 py-2 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 sm:w-auto sm:justify-start sm:text-left"
                    aria-disabled={ownerPreviewPending}
                    data-cy="chatbot-owner-preview-link"
                    onClick={handleOwnerPreviewClick}
                  >
                    <span>{t('manage.resources.openOwnerPreview')}</span>
                    <span className="sr-only">
                      {' '}
                      {t('chat.common.opensInNewTab')}
                    </span>
                    <FontAwesomeIcon
                      icon={faExternalLinkAlt}
                      className="h-3 w-3"
                      aria-hidden="true"
                    />
                  </a>
                  {/* Only a published chatbot has a live configuration that can
                      differ from the saved one. */}
                  {chatbot.status === ChatbotStatus.Published ? (
                    <span
                      className="max-w-full break-words text-center text-xs text-gray-500 sm:max-w-xs sm:text-right"
                      data-cy="chatbot-owner-preview-live-label"
                    >
                      <span className="font-medium text-gray-700">
                        {t('manage.resources.chatbotOwnerPreviewLive')}
                      </span>
                      {advancedManagement
                        ? ` ${t('manage.resources.chatbotOwnerPreviewLiveDescription')}`
                        : null}
                    </span>
                  ) : null}
                </div>
              )}
          </div>
          {singlePageSetup ? (
            <p
              className="mt-1 text-sm text-gray-500"
              data-cy="chatbot-draft-visibility"
            >
              {courseNames.length > 0
                ? t('manage.resources.chatbotDraftVisibility', {
                    courses: formatList(courseNames),
                  })
                : t('manage.resources.chatbotDraftVisibilityNoCourse')}
            </p>
          ) : (
            <ChatbotRevisionStatusNotice chatbot={chatbot} />
          )}
          {chatbot.description && (
            <div className="mt-1 text-sm text-gray-600">
              {chatbot.description}
            </div>
          )}
          {advancedManagement && !singlePageSetup ? technicalDetails : null}
        </div>

        {!singlePageSetup && chatbot.courses && chatbot.courses.length > 0 && (
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

        {view ? (
          <ChatbotWorkspaceNavigation
            view={view}
            step={step}
            showUsage={advancedManagement}
            onNavigate={onNavigate}
          />
        ) : null}

        {singlePageSetup ? (
          <div
            key={chatbot.id}
            className="space-y-3"
            data-cy="chatbot-draft-setup"
          >
            <ChatbotSetupSection
              id="materials"
              title={sectionTitles.materials}
              status={materialsStatus}
              summary={materialsSummary}
              open={openSections.includes('materials')}
              onOpenChange={(open) => setSetupSectionOpen('materials', open)}
            >
              <p className="text-sm text-gray-600">
                {t('manage.resources.chatbotDraftStepMaterialsDescription')}
              </p>
              <ChatbotKnowledgeBaseSetup
                key={chatbot.id}
                chatbotId={chatbot.id}
                chatbotStatus={chatbot.status}
                courseIds={chatbot.courses?.map(({ id }) => id) ?? []}
                connectedKnowledgeBase={connectedKnowledgeBase}
                connectOnSelect
                proposedKnowledgeBaseName={chatbot.name}
              />
            </ChatbotSetupSection>

            <ChatbotSetupSection
              id="students"
              title={sectionTitles.students}
              status={studentsStatus}
              summary={studentsSummary}
              open={openSections.includes('students')}
              onOpenChange={(open) => setSetupSectionOpen('students', open)}
              headerAction={
                <button
                  type="button"
                  className="text-primary-100 shrink-0 text-sm font-medium hover:underline"
                  onClick={openStudentsPreview}
                  data-cy="chatbot-section-students-preview"
                >
                  {t('manage.resources.chatbotStudentsPreview')}
                </button>
              }
              footer={
                setupEditable
                  ? {
                      onSave: () =>
                        void disclaimerFormRef.current?.submitForm(),
                      // Unstored suggested text can be saved as it is.
                      saveDisabled:
                        (studentInformationStored &&
                          !disclaimerNavigationState.dirty) ||
                        disclaimerNavigationState.pending,
                      saving: disclaimerNavigationState.pending,
                      dirty: disclaimerNavigationState.dirty,
                      onDiscard: () => disclaimerFormRef.current?.resetForm(),
                    }
                  : undefined
              }
            >
              <p className="text-sm text-gray-600">
                {t('manage.resources.chatbotDraftStepStudentsDescription')}
              </p>
              <ChatbotAuthoring
                key={`${chatbot.id}:disclaimer`}
                chatbot={chatbot}
                advancedManagement={advancedManagement}
                step="disclaimer"
                sections={['disclaimer']}
                embedded
                formRef={disclaimerFormRef}
                onSaved={() => closeSetupSection('students')}
                publishingAuthorized={publishingAuthorized}
                publishingAuthorizationLoading={publishingAuthorizationLoading}
                publishingAuthorizationError={publishingAuthorizationError}
                onNavigationStateChange={setDisclaimerNavigationState}
              />
            </ChatbotSetupSection>

            <p className="px-1 pt-5 text-sm text-gray-500">
              {t('manage.resources.chatbotSectionGroupOptional')}
            </p>

            <ChatbotSetupSection
              id="modes"
              title={sectionTitles.modes}
              status={modesStatus}
              summary={modesSummary}
              open={openSections.includes('modes')}
              onOpenChange={(open) => setSetupSectionOpen('modes', open)}
              footer={
                setupEditable
                  ? {
                      onSave: () => void modesFormRef.current?.submitForm(),
                      saveDisabled:
                        !behaviorNavigationState.dirty ||
                        behaviorNavigationState.pending,
                      saving: behaviorNavigationState.pending,
                      dirty: behaviorNavigationState.dirty,
                      onDiscard: () => {
                        modesFormRef.current?.resetForm()
                        customModesFormRef.current?.resetForm()
                      },
                    }
                  : undefined
              }
            >
              <ChatbotAuthoring
                key={`${chatbot.id}:behavior`}
                chatbot={chatbot}
                advancedManagement={advancedManagement}
                step="modes"
                sections={['modes']}
                embedded
                formRef={modesFormRef}
                customModesFormRef={customModesFormRef}
                onSaved={() => closeSetupSection('modes')}
                publishingAuthorized={publishingAuthorized}
                publishingAuthorizationLoading={publishingAuthorizationLoading}
                publishingAuthorizationError={publishingAuthorizationError}
                onNavigationStateChange={setBehaviorNavigationState}
              />
            </ChatbotSetupSection>

            <ChatbotSetupSection
              id="model"
              title={sectionTitles.model}
              status={modelStatus}
              summary={modelSummary}
              open={openSections.includes('model')}
              onOpenChange={(open) => setSetupSectionOpen('model', open)}
              footer={
                setupEditable
                  ? {
                      onSave: () =>
                        void handleSaveModelSettings().then((saved) => {
                          if (saved) closeSetupSection('model')
                        }),
                      saveDisabled: !modelSettingsDirty || isSaving,
                      saving: isSaving && modelSettingsDirty,
                      dirty: modelSettingsDirty,
                      onDiscard: () => {
                        clearRevisionConflict()
                        resetModelSettings()
                      },
                    }
                  : undefined
              }
            >
              {modelSettings}
            </ChatbotSetupSection>

            <ChatbotSetupSection
              id="usage"
              title={sectionTitles.usage}
              status={usageStatus}
              summary={usageLimitsSummary}
              open={openSections.includes('usage')}
              onOpenChange={(open) => setSetupSectionOpen('usage', open)}
              footer={
                setupEditable
                  ? {
                      onSave: () => void creditFormRef.current?.submitForm(),
                      saveDisabled:
                        !creditNavigationState.dirty ||
                        creditNavigationState.pending,
                      saving: creditNavigationState.pending,
                      dirty: creditNavigationState.dirty,
                      onDiscard: () => creditFormRef.current?.resetForm(),
                    }
                  : undefined
              }
            >
              <p className="text-sm text-gray-600">
                {t('manage.resources.chatbotCreditPolicyDescription')}
              </p>
              <ChatbotCreditPolicy
                key={chatbot.id}
                chatbot={chatbot}
                publicationPending={false}
                embedded
                formRef={creditFormRef}
                onSaved={() => closeSetupSection('usage')}
                onNavigationStateChange={setCreditNavigationState}
                onRevisionConflict={markRevisionConflict}
              />
              {revisionConflict ? (
                <ChatbotRevisionConflictNotice
                  message={t('manage.resources.chatbotRevisionConflict')}
                  onReload={() => void reloadAfterConflict()}
                  reloading={revisionReloading}
                  testId="chatbot-revision-reload-credits"
                />
              ) : null}
            </ChatbotSetupSection>

            <p className="px-1 pt-5 text-sm text-gray-500">
              {t('manage.resources.chatbotSectionGroupAdvanced')}
            </p>

            <ChatbotSetupSection
              id="graph"
              title={sectionTitles.graph}
              status={graphStatus}
              summary={graphSummary}
              open={openSections.includes('graph')}
              onOpenChange={(open) => setSetupSectionOpen('graph', open)}
              footer={
                setupEditable
                  ? {
                      onSave: () =>
                        void handleSaveKnowledgeGraphPolicy().then((saved) => {
                          if (saved) closeSetupSection('graph')
                        }),
                      saveDisabled: !knowledgeGraphDirty || isSaving,
                      saving: isSaving && knowledgeGraphDirty,
                      dirty: knowledgeGraphDirty,
                      onDiscard: () => {
                        clearRevisionConflict()
                        resetKnowledgeGraphPolicy()
                      },
                    }
                  : undefined
              }
            >
              {knowledgeAdvancedSettings}
            </ChatbotSetupSection>

            <section
              id="chatbot-section-request"
              className="mt-6 scroll-mt-4 space-y-4 rounded-lg border border-gray-200 bg-white p-4"
              data-cy="chatbot-section-request"
            >
              <h3 className="font-semibold text-gray-900">
                {t('manage.resources.chatbotSectionRequest')}
              </h3>
              <ChatbotAuthoring
                key={`${chatbot.id}:publication`}
                chatbot={chatbot}
                advancedManagement={advancedManagement}
                step="review"
                sections={['review']}
                embedded
                blockers={requestBlockers}
                onBlockerClick={(id) =>
                  openSetupSection(id as ChatbotSetupSectionId)
                }
                siblingPending={
                  basicsNavigationState.pending ||
                  disclaimerNavigationState.pending ||
                  behaviorNavigationState.pending ||
                  creditNavigationState.pending ||
                  isSaving
                }
                publishingAuthorized={publishingAuthorized}
                publishingAuthorizationLoading={publishingAuthorizationLoading}
                publishingAuthorizationError={publishingAuthorizationError}
                onNavigateSection={(section) => {
                  if (section === 'basics') setDetailsOpen(true)
                  if (section === 'disclaimer') openSetupSection('students')
                  if (section === 'modes') openSetupSection('modes')
                  if (section === 'credits') openSetupSection('usage')
                }}
                onNavigationStateChange={setAuthoringNavigationState}
              />
            </section>

            {advancedManagement ? technicalDetails : null}

            <Modal
              open={detailsOpen}
              title={t('manage.resources.chatbotEditDetailsTitle')}
              onClose={() => {
                basicsFormRef.current?.resetForm()
                setDetailsOpen(false)
              }}
              primaryButtonStyle="primary"
              primaryLabel={t('manage.resources.chatbotSectionSave')}
              onPrimaryAction={() => void basicsFormRef.current?.submitForm()}
              dataPrimaryAction={{ cy: 'chatbot-edit-details-save' }}
              secondaryLabel={t('shared.generic.cancel')}
              onSecondaryAction={() => {
                basicsFormRef.current?.resetForm()
                setDetailsOpen(false)
              }}
              dataSecondaryAction={{ cy: 'chatbot-edit-details-cancel' }}
              className={{ content: 'max-w-2xl' }}
              data={{ cy: 'chatbot-edit-details-modal' }}
            >
              <ChatbotAuthoring
                key={`${chatbot.id}:basics`}
                chatbot={chatbot}
                advancedManagement={advancedManagement}
                step="basics"
                sections={['basics']}
                embedded
                formRef={basicsFormRef}
                onSaved={() => setDetailsOpen(false)}
                publishingAuthorized={publishingAuthorized}
                publishingAuthorizationLoading={publishingAuthorizationLoading}
                publishingAuthorizationError={publishingAuthorizationError}
                onNavigationStateChange={setBasicsNavigationState}
              />
            </Modal>

            <Modal
              open={studentsPreview !== null}
              title={t('manage.resources.chatbotStudentsPreviewTitle')}
              onClose={() => setStudentsPreview(null)}
              className={{ content: 'max-w-2xl' }}
              data={{ cy: 'chatbot-students-preview-modal' }}
            >
              <ChatbotDisclaimerPreview
                title={studentsPreview?.title ?? ''}
                introText={studentsPreview?.introText ?? ''}
              />
            </Modal>
          </div>
        ) : null}

        {view === 'overview' ? (
          <section className="space-y-6" data-cy="chatbot-overview">
            <div
              className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              data-cy="chatbot-overview-summary"
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
                <div className="border-t border-gray-200 pt-3">
                  <H4>{t('manage.resources.chatbotDisclaimerPreview')}</H4>
                  <p className="mb-3 text-sm text-gray-600">
                    {t('manage.resources.chatbotDisclaimerPreviewDescription')}
                  </p>
                  <p
                    className="mb-3 text-xs font-medium text-gray-600"
                    data-cy="chatbot-live-disclaimer-label"
                  >
                    {t('manage.resources.chatbotOwnerPreviewLive')}
                  </p>
                  <ChatbotDisclaimerPreview
                    title={chatbot.disclaimerSummary?.title ?? ''}
                    introText={chatbot.disclaimerSummary?.introText ?? ''}
                  />
                </div>
              ) : null}
            </div>
            <ChatbotAuthoring
              key={`${chatbot.id}:overview`}
              chatbot={chatbot}
              advancedManagement={advancedManagement}
              step={step ?? 'basics'}
              sections={['basics', 'review']}
              siblingDirty={
                creditNavigationState.dirty ||
                modelSettingsDirty ||
                knowledgeGraphDirty
              }
              siblingPending={creditNavigationState.pending || isSaving}
              publishingAuthorized={publishingAuthorized}
              publishingAuthorizationLoading={publishingAuthorizationLoading}
              publishingAuthorizationError={publishingAuthorizationError}
              onNavigateSection={(section) => {
                if (section === 'modes') onNavigate('behavior')
                if (section === 'credits') onNavigate('usage')
                if (section === 'disclaimer') {
                  onNavigate('disclaimer')
                }
              }}
              onNavigationStateChange={setAuthoringNavigationState}
            />
            {advancedManagement ? null : (
              <ChatbotAdvancedSettings
                advancedManagement={advancedManagement}
                cy="chatbot-overview-advanced"
              >
                {usageSettings}
              </ChatbotAdvancedSettings>
            )}
          </section>
        ) : null}

        {view === 'knowledge' ? (
          <section
            className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            data-cy="chatbot-knowledge"
          >
            <H4>{t('manage.resources.chatbotWorkspaceKnowledge')}</H4>
            <p className="text-sm text-gray-600">
              {t('manage.resources.chatbotWorkspaceKnowledgeDescription')}
            </p>
            <div data-cy="chatbot-knowledge-base">
              <div className="mb-2 text-sm font-medium text-gray-700">
                {t('manage.resources.knowledgeBase')}
              </div>
              {enabledKnowledgeBases.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  {enabledKnowledgeBases.map((knowledgeBase) => (
                    <Link
                      key={knowledgeBase.id}
                      href={`/resources/knowledgeBases/${knowledgeBase.id}`}
                      className="text-primary-100 hover:underline"
                      data-cy="chatbot-enabled-knowledge-base"
                    >
                      {knowledgeBase.name}
                    </Link>
                  ))}
                  {advancedManagement && enabledKnowledgeBases.length === 1 ? (
                    <span className="text-sm text-gray-600">
                      {t('manage.resources.chatbotKnowledgeSingleActive')}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <UserNotification
                    type="warning"
                    message={t('manage.resources.noEnabledKnowledgeBase')}
                    data={{ cy: 'chatbot-no-enabled-knowledge-base' }}
                  />
                  <p
                    className="text-sm text-gray-600"
                    data-cy="chatbot-knowledge-empty-description"
                  >
                    {t('manage.resources.chatbotKnowledgeEmptyDescription')}
                  </p>
                </div>
              )}
            </div>
            <ChatbotKnowledgeBaseSetup
              key={chatbot.id}
              chatbotId={chatbot.id}
              chatbotStatus={chatbot.status}
              courseIds={chatbot.courses?.map(({ id }) => id) ?? []}
              connectedKnowledgeBase={enabledKnowledgeBases[0]}
            />
            <ChatbotAdvancedSettings
              advancedManagement={advancedManagement}
              cy="chatbot-knowledge-advanced"
            >
              {knowledgeAdvancedSettings}
            </ChatbotAdvancedSettings>
          </section>
        ) : null}

        {view === 'behavior' ? (
          <ChatbotAuthoring
            key={`${chatbot.id}:behavior`}
            chatbot={chatbot}
            advancedManagement={advancedManagement}
            step="modes"
            sections={['modes']}
            publishingAuthorized={publishingAuthorized}
            publishingAuthorizationLoading={publishingAuthorizationLoading}
            publishingAuthorizationError={publishingAuthorizationError}
            onNavigateSection={(section) => {
              if (section === 'disclaimer') {
                onNavigate('disclaimer')
              }
              if (section === 'basics' || section === 'review') {
                onNavigate('overview', section)
              }
            }}
            onNavigationStateChange={setAuthoringNavigationState}
          />
        ) : null}

        {view === 'disclaimer' ? (
          <ChatbotAuthoring
            key={`${chatbot.id}:disclaimer`}
            chatbot={chatbot}
            advancedManagement={advancedManagement}
            step="disclaimer"
            sections={['disclaimer']}
            publishingAuthorized={publishingAuthorized}
            publishingAuthorizationLoading={publishingAuthorizationLoading}
            publishingAuthorizationError={publishingAuthorizationError}
            onNavigateSection={(section) => {
              if (section === 'modes') onNavigate('behavior')
              if (section === 'basics' || section === 'review') {
                onNavigate('overview', section)
              }
            }}
            onNavigationStateChange={setAuthoringNavigationState}
          />
        ) : null}

        {view === 'usage' ? usageSettings : null}

        {view === 'behavior' ? (
          <div className="space-y-6" data-cy="chatbot-behavior-model">
            <ChatbotAdvancedSettings
              advancedManagement={advancedManagement}
              cy="chatbot-behavior-advanced"
            >
              {modelSettings}
            </ChatbotAdvancedSettings>

            <div className="mt-8 flex flex-wrap gap-4 border-t pt-4 text-xs text-gray-500">
              {advancedManagement && (
                // Restates the model policy next to the timestamps below so
                // it stays readable without reopening the settings above.
                <>
                  <div>
                    {t('manage.resources.modelSelection')}:{' '}
                    {modelSelectionEnabled
                      ? t('manage.resources.modelSelectionEnabled')
                      : t('manage.resources.modelSelectionDisabled')}
                  </div>
                  <div>
                    {t('manage.resources.allowedModels')}:{' '}
                    {modelSelectionEnabled
                      ? allowedModelIds
                          .map(
                            (modelId) =>
                              modelRegistry.find(
                                (model) => model.id === modelId
                              )?.name ?? modelId
                          )
                          .join(', ')
                      : (modelRegistry.find(
                          (model) => model.id === fixedModelId
                        )?.name ?? fixedModelId)}
                  </div>
                </>
              )}
              <div>
                {t('shared.generic.createdAt', {
                  date: createdAtLabel,
                })}
              </div>
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
