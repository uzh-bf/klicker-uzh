import { useMutation, useQuery } from '@apollo/client'
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import {
  ChatbotStatus,
  type ChatModelCapability,
  ChatUsageClass,
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
  Checkbox,
  H3,
  Modal,
  Select,
  Switch,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import type { FormikProps, FormikValues } from 'formik'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import {
  type MouseEvent,
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
import {
  getChatbotMutationErrorKey,
  isChatbotRevisionConflict,
} from './chatbotErrorMessages'
import { canUseChatbotOwnerPreview } from './chatbotOwnerPreviewAccess'
import { buildChatbotOwnerPreviewUrl } from './chatbotOwnerPreviewUrl'
import {
  ChatbotRevisionConflictNotice,
  type ChatbotRevisionValues,
  getChatbotRevisionStatus,
  getChatbotRevisionValues,
  getChatbotRevisionVersion,
  hasChatbotAuthoringRevision,
  isChatbotRevisionEditable,
  isChatbotRevisionPending,
  type RevisionChatbot,
  useChatbotRevisionReload,
} from './chatbotRevision'
import {
  type ChatbotSetupSectionId,
  type ChatbotSetupSectionStatus,
  type CreditPolicyValues,
  hasModeFraming,
  hasUnsubmittedChanges,
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
} from './chatbotWorkspace'

// The comparable part of a learning mode configuration, so a saved revision
// and the live chatbot compare by value whatever the field order.
function getModeComparison(
  standard: ChatbotRevisionValues['standardModeConfig'],
  custom: ChatbotRevisionValues['customModeConfig']
) {
  return {
    tutorEnabled: standard?.tutorEnabled ?? null,
    explainerEnabled: standard?.explainerEnabled ?? null,
    quizzerEnabled: standard?.quizzerEnabled ?? null,
    courseName: standard?.courseName ?? null,
    subjectDomain: standard?.subjectDomain ?? null,
    languageOfInstruction: standard?.languageOfInstruction ?? null,
    scopeNote: standard?.scopeNote ?? null,
    customModes: (custom?.modes ?? []).map((mode) => ({
      key: mode.key,
      name: mode.name,
      description: mode.description ?? null,
      personaText: mode.personaText ?? null,
      welcomeMessage: mode.welcomeMessage ?? null,
      starterPrompts: mode.starterPrompts ?? null,
      showReasoning: mode.showReasoning,
    })),
  }
}

function getModelComparison(
  values: Pick<
    ChatbotRevisionValues,
    'modelSelection' | 'allowedModelIds' | 'allowedReasoningEffortsByModel'
  >
) {
  return {
    modelSelection: values.modelSelection,
    allowedModelIds: [...values.allowedModelIds].sort((a, b) =>
      a.localeCompare(b)
    ),
    efforts: values.allowedReasoningEffortsByModel
      .map(({ modelId, efforts }) => ({ modelId, efforts: [...efforts] }))
      .sort((a, b) => a.modelId.localeCompare(b.modelId)),
  }
}

type ChatbotModelPolicy = Pick<
  ChatbotRevisionValues,
  'modelSelection' | 'allowedModelIds' | 'allowedReasoningEffortsByModel'
>
type ReasoningConfigState = Record<string, string[]>

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

function ChatbotDetails({
  chatbot,
  modelRegistry,
  loading,
  advancedManagement,
  view: requestedView,
  step,
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
  onNavigationStateChange: (state: ChatbotNavigationState) => void
  publishingAuthorized: boolean
  publishingAuthorizationLoading: boolean
  publishingAuthorizationError: boolean
}) {
  const t = useTranslations()
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
      },
      // Without the suggestions the section shows Saved instead of
      // Suggested, which is still correct.
      () => undefined
    )
    return () => {
      active = false
    }
  }, [])

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
  const setupLinkTarget = getSetupLinkTarget({ view: requestedView, step })
  const linkedChatbotId = chatbot?.id
  useEffect(() => {
    if (!linkedChatbotId) return
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
  }, [linkedChatbotId, scrollToSetupElement, setupLinkTarget])

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
  }, [
    authoringNavigationState,
    basicsNavigationState,
    behaviorNavigationState,
    creditNavigationState,
    disclaimerNavigationState,
    isSaving,
    knowledgeGraphDirty,
    modelSettingsDirty,
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

  const createdAtLabel = chatbot.createdAt
    ? dayjs(chatbot.createdAt).format('DD.MM.YYYY HH:mm')
    : t('shared.generic.unknown')
  const updatedAtLabel = chatbot.updatedAt
    ? dayjs(chatbot.updatedAt).format('DD.MM.YYYY HH:mm')
    : t('shared.generic.unknown')

  // An unused chatbot has no usage rows yet, so empty values read as "none
  // yet" rather than unknown.
  const usageSummary = chatbot.usageSummary
  const noneYet = t('manage.resources.chatbotUsageNoneYet')
  const formatUsageDate = (value?: string | null) =>
    value ? dayjs(value).format('DD.MM.YYYY HH:mm') : noneYet
  const formatNumber = (value?: number | null) => (value ?? 0).toLocaleString()

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
  // The request card reports its submission through the authoring state.
  const publicationSubmitting = authoringNavigationState.pending

  const handleAllowedModelToggle = (modelId: string, checked: boolean) => {
    setSaveError(null)
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
    clearRevisionConflict()
    setFixedModelId(modelId)
  }

  const handleModelSelectionChange = (checked: boolean) => {
    setSaveError(null)
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

      return true
    } catch (error) {
      if (isChatbotRevisionConflict(error)) markRevisionConflict()
      setSaveError(t(getChatbotMutationErrorKey(error, 'metadata')))
      return false
    }
  }

  const handleSaveKnowledgeGraphPolicy = async () => {
    setKnowledgeGraphSaveError(null)
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
      <div className="space-y-4">
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
              disabled={
                isSaving ||
                !modelSettingsEditable ||
                revisionPending ||
                publicationSubmitting
              }
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
              disabled={
                isSaving ||
                !modelSettingsEditable ||
                revisionPending ||
                publicationSubmitting
              }
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
                            revisionPending ||
                            publicationSubmitting
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
      {/* Concept-map visibility and graph-retrieval tuning assume the reader understands how the knowledge graph is built and queried, which an ordinary lecturer does not need to reason about to run a chatbot. */}
      <div className="space-y-4" data-cy="chatbot-knowledge-graph-policy">
        <div>
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
              disabled={
                isSaving ||
                !modelSettingsEditable ||
                revisionPending ||
                publicationSubmitting
              }
              onCheckedChange={(checked) => {
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
                disabled={
                  isSaving ||
                  !modelSettingsEditable ||
                  revisionPending ||
                  publicationSubmitting
                }
                onCheckedChange={(checked) => {
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

  // A published chatbot keeps its live values until a review approves the
  // saved revision, so a section whose saved values differ from the live ones
  // is saved but not yet submitted.
  const comparesLiveValues =
    chatbot.status === ChatbotStatus.Published &&
    hasChatbotAuthoringRevision(chatbot)
  const unsubmitted = <Values,>(saved: Values, live: Values) =>
    comparesLiveValues && hasUnsubmittedChanges(saved, live)

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
    (savedValues.disclaimerTitle !== null &&
      savedValues.disclaimerTitle !== undefined) ||
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
    notSubmitted: unsubmitted(
      {
        title: savedValues.disclaimerTitle ?? null,
        introText: savedValues.disclaimerIntroText ?? null,
      },
      {
        title: chatbot.disclaimerSummary?.title ?? null,
        introText: chatbot.disclaimerSummary?.introText ?? null,
      }
    ),
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
    notSubmitted: unsubmitted(
      getModeComparison(
        savedValues.standardModeConfig,
        savedValues.customModeConfig
      ),
      getModeComparison(
        chatbot.standardModeConfig ?? null,
        chatbot.customModeConfig ?? null
      )
    ),
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
          framing: hasModeFraming(savedModes) ? 'set' : 'none',
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
    notSubmitted: unsubmitted(
      getModelComparison(savedValues),
      getModelComparison({
        modelSelection: chatbot.modelSelection,
        allowedModelIds: chatbot.allowedModelIds,
        allowedReasoningEffortsByModel:
          chatbot.allowedReasoningEffortsByModel ?? [],
      })
    ),
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
  const savedChoiceModelIds = getInitialSelectedModelIds(
    savedValues,
    modelRegistry
  )
  const modelSummary = savedValues.modelSelection
    ? t('manage.resources.chatbotSummaryModelChoice', {
        models: formatList(savedChoiceModelIds.map(getModelName)),
        count: savedChoiceModelIds.length,
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

  const creditFields = ({
    creditInitialCredits,
    creditResetPeriod,
    creditResetAmount,
    creditMaxCredits,
  }: CreditPolicyValues) => ({
    creditInitialCredits,
    creditResetPeriod,
    creditResetAmount,
    creditMaxCredits,
  })
  const usageStatus = resolveSectionStatus({
    unsaved: creditNavigationState.dirty,
    notSubmitted: unsubmitted(creditFields(savedValues), creditFields(chatbot)),
    isDefault: isDefaultCreditPolicy(savedValues),
  })
  const describeCreditPolicy = (values: CreditPolicyValues) =>
    [
      t('manage.resources.chatbotSummaryUsageInitial', {
        initial: values.creditInitialCredits,
      }),
      t('manage.resources.chatbotSummaryUsageRefill', {
        period: values.creditResetPeriod,
        amount: values.creditResetAmount,
        max: values.creditMaxCredits,
      }),
    ].join(' ')
  const usageLimitsSummary = describeCreditPolicy(savedValues)

  const graphStatus = resolveSectionStatus({
    unsaved: knowledgeGraphDirty,
    notSubmitted: unsubmitted(
      {
        visible: savedValues.knowledgeGraphVisible,
        retrieval: savedValues.knowledgeGraphRetrievalEnabled,
      },
      {
        visible: chatbot.knowledgeGraphVisible,
        retrieval: chatbot.knowledgeGraphRetrievalEnabled,
      }
    ),
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
  const paused = chatbot.status === ChatbotStatus.Paused
  const unsubmittedSections = sectionStatuses
    .filter(([, status]) => status === 'notSubmitted')
    .map(([id]) => sectionTitles[id])
  // Knowledge base changes take effect without review, also while a request
  // is pending; every other section of a live chatbot waits for review.
  const materialsApplyLabel =
    chatbot.status === ChatbotStatus.Published || revisionPending
      ? t('manage.resources.chatbotSectionAppliesImmediately')
      : undefined
  const revisionApplyLabel =
    chatbot.status === ChatbotStatus.Published && !revisionPending
      ? t('manage.resources.chatbotSectionAppliesAfterReview')
      : undefined
  // A published chatbot has nothing to submit until a section saves a
  // revision, and a paused one cannot change.
  const showRequestCard =
    !paused &&
    (chatbot.status !== ChatbotStatus.Published ||
      revisionPending ||
      comparesLiveValues)
  const finalCardTitle = revisionPending
    ? t('manage.resources.chatbotSectionRequestPending')
    : chatbot.status === ChatbotStatus.Published
      ? t('manage.resources.chatbotSectionSubmitChanges')
      : t('manage.resources.chatbotSectionRequest')
  const closeSetupSection = (section: ChatbotSetupSectionId) =>
    setSetupSectionOpen(section, false)
  const courseNames = (chatbot.courses ?? []).map(({ name }) => name)
  const courseList = courseNames.length > 0 ? formatList(courseNames) : null
  // Students see a published chatbot, also while a revision of it waits for
  // review, and no other status.
  const visibilityLabel =
    chatbot.status === ChatbotStatus.Published
      ? courseList
        ? t('manage.resources.chatbotLiveVisibility', { courses: courseList })
        : t('manage.resources.chatbotLiveVisibilityNoCourse')
      : chatbot.status === ChatbotStatus.Paused
        ? courseList
          ? t('manage.resources.chatbotPausedVisibility', {
              courses: courseList,
            })
          : t('manage.resources.chatbotPausedVisibilityNoCourse')
        : courseList
          ? t('manage.resources.chatbotDraftVisibility', {
              courses: courseList,
            })
          : t('manage.resources.chatbotDraftVisibilityNoCourse')
  const usageStripItems = [
    {
      key: 'threads',
      label: t('manage.resources.usageThreads'),
      value: formatNumber(usageSummary?.threadCount),
    },
    {
      key: 'messages',
      label: t('manage.resources.usageMessages'),
      value: formatNumber(usageSummary?.messageCount),
    },
    {
      key: 'students',
      label: t('manage.resources.usageParticipants'),
      value: formatNumber(usageSummary?.participantCount),
    },
    {
      key: 'credits',
      label: t('manage.resources.usageCurrentCredits'),
      value:
        usageSummary?.totalCredits === null ||
        usageSummary?.totalCredits === undefined
          ? noneYet
          : t('manage.resources.chatbotUsageCreditsValue', {
              current: formatNumber(usageSummary.currentCredits),
              total: formatNumber(usageSummary.totalCredits),
            }),
    },
    {
      key: 'activity',
      label: t('manage.resources.usageLastActivity'),
      value: formatUsageDate(usageSummary?.lastActivityAt),
    },
    {
      key: 'reset',
      label: t('manage.resources.usageLastReset'),
      value: formatUsageDate(usageSummary?.lastResetAt),
    },
    {
      key: 'student-information',
      label: t('manage.resources.chatbotSectionStudents'),
      value: t('manage.resources.chatbotUsageStudentInformationValue', {
        accepted: chatbot.disclaimerSummary?.acceptedCount ?? 0,
        declined: chatbot.disclaimerSummary?.declinedCount ?? 0,
        pending: chatbot.disclaimerSummary?.pendingCount ?? 0,
      }),
    },
  ]
  // The live policy keeps applying to students until a review approves the
  // saved one, so a published chatbot shows it while the two differ.
  const liveCreditPolicySummary = describeCreditPolicy(creditFields(chatbot))
  const changesRequested =
    chatbot.status === ChatbotStatus.Rejected ||
    getChatbotRevisionStatus(chatbot) === ChatbotStatus.Rejected

  // The setup page lists these identifiers last, as a closed section.
  const technicalDetails = (
    <details
      className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-500"
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
        <div>{t('shared.generic.createdAt', { date: createdAtLabel })}</div>
        <div>{t('shared.generic.updatedAt', { date: updatedAtLabel })}</div>
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
              {changesRequested ? (
                <Badge
                  className="bg-amber-100 text-amber-900 hover:bg-amber-200"
                  data-cy="chatbot-changes-requested"
                >
                  {t('manage.resources.chatbotChangesRequested')}
                </Badge>
              ) : null}
              {setupEditable ? (
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
          <p
            className="mt-1 text-sm text-gray-500"
            data-cy="chatbot-draft-visibility"
          >
            {visibilityLabel}
          </p>
          {chatbot.status === ChatbotStatus.Published &&
          (chatbot.courses?.length ?? 0) > 0 ? (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {chatbot.courses?.map((course) => (
                <a
                  key={`chatbot-course-${course.id}`}
                  href={buildChatbotUrl(course.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-100 flex items-center gap-1.5 text-sm hover:underline"
                  data-cy="chatbot-participant-link"
                >
                  <span>
                    {t('manage.resources.chatbotOpenForCourse', {
                      course: course.name,
                    })}
                  </span>
                  <FontAwesomeIcon
                    icon={faExternalLinkAlt}
                    className="h-3 w-3"
                    aria-hidden="true"
                  />
                </a>
              ))}
            </div>
          ) : null}
          {chatbot.description && (
            <div className="mt-1 text-sm text-gray-600">
              {chatbot.description}
            </div>
          )}
        </div>

        {chatbot.status === ChatbotStatus.Published || paused ? (
          <dl
            className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
            data-cy="chatbot-usage-strip"
          >
            {usageStripItems.map(({ key, label, value }) => (
              <div key={key} className="min-w-0">
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="font-medium text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div
          key={chatbot.id}
          className="space-y-3"
          data-cy="chatbot-draft-setup"
        >
          {paused ? (
            <UserNotification
              message={t('manage.resources.chatbotPausedNotice')}
              data={{ cy: 'chatbot-paused-notice' }}
            />
          ) : null}
          <ChatbotSetupSection
            id="materials"
            title={sectionTitles.materials}
            status={materialsStatus}
            summary={materialsSummary}
            applyLabel={materialsApplyLabel}
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
              readOnly={paused}
            />
          </ChatbotSetupSection>

          <ChatbotSetupSection
            id="students"
            title={sectionTitles.students}
            status={studentsStatus}
            summary={studentsSummary}
            applyLabel={revisionApplyLabel}
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
                    onSave: () => void disclaimerFormRef.current?.submitForm(),
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
              publicationSubmitting={publicationSubmitting}
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
            applyLabel={revisionApplyLabel}
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
              publicationSubmitting={publicationSubmitting}
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
            applyLabel={revisionApplyLabel}
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
            applyLabel={revisionApplyLabel}
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
            {chatbot.status === ChatbotStatus.Published &&
            liveCreditPolicySummary !== usageLimitsSummary ? (
              <p
                className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700"
                data-cy="chatbot-live-credit-policy"
              >
                {t('manage.resources.chatbotLiveCreditPolicy', {
                  policy: liveCreditPolicySummary,
                })}
              </p>
            ) : null}
            <ChatbotCreditPolicy
              key={chatbot.id}
              chatbot={chatbot}
              publicationPending={publicationSubmitting}
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
            applyLabel={revisionApplyLabel}
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

          {showRequestCard ? (
            <section
              id="chatbot-section-request"
              className="mt-6 scroll-mt-4 space-y-4 rounded-lg border border-gray-200 bg-white p-4"
              data-cy="chatbot-section-request"
            >
              <h3 className="font-semibold text-gray-900">{finalCardTitle}</h3>
              {unsubmittedSections.length > 0 ? (
                <p
                  className="text-sm text-gray-600"
                  data-cy="chatbot-unsubmitted-sections"
                >
                  {t('manage.resources.chatbotUnsubmittedSections', {
                    sections: formatList(unsubmittedSections),
                  })}
                </p>
              ) : null}
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
          ) : null}

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
            dataContent={{ cy: 'chatbot-edit-details-modal' }}
          >
            <ChatbotAuthoring
              key={`${chatbot.id}:basics`}
              publicationSubmitting={publicationSubmitting}
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
            dataContent={{ cy: 'chatbot-students-preview-modal' }}
          >
            <ChatbotDisclaimerPreview
              title={studentsPreview?.title ?? ''}
              introText={studentsPreview?.introText ?? ''}
            />
          </Modal>
        </div>
      </div>
    </div>
  )
}

export default ChatbotDetails
