import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import {
  faChevronRight,
  faEllipsisVertical,
  faFileLines,
  faLink,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AddKbLinkToChatbotDocument,
  AttachKbToChatbotDocument,
  ChatbotStatus,
  DetachKbFromChatbotDocument,
  GetKbResourcesWithFailureDetailDocument,
  GetUserCoursesDocument,
  GetUserKbsDocument,
  KbIngestionStatus,
  KbResourceType,
  QGetChatbotsInfoWithKnowledgeBasesDocument,
  SetChatbotDefaultKbDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  CreateKnowledgeBaseModal,
  domainGenerationLanguageForLocale,
  KnowledgeBaseAddResourceModal,
  RunStatusBadge,
  RunStatusMessage,
} from '@klicker-uzh/kb-management'
import {
  Badge,
  Button,
  Dropdown,
  Modal,
  SelectField,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useFormatter, useTranslations } from 'next-intl'
import { useId, useEffect, useRef, useState } from 'react'

// The largest page the knowledge-base list accepts in one request.
const KB_LIST_PAGE_SIZE = 50

const refetchQueries = [{ query: QGetChatbotsInfoWithKnowledgeBasesDocument }]

// The legacy select value that stands for answering without a knowledge base.
const NO_KNOWLEDGE_BASE = 'no-knowledge-base'

// How many of the newest resources the knowledge base card lists.
const RECENT_RESOURCE_COUNT = 5

// The knowledge base page refreshes running resources at this interval too.
const ACTIVE_RESOURCE_POLL_MS = 2000

type MaterialsReadiness = {
  visibleResourceCount: number
  servingResourceCount: number
  processingResourceCount: number
  failedResourceCount: number
  lastChangedAt?: string | null
}

type ConnectedKnowledgeBase = {
  id: string
  kbId?: string
  linkId?: string | null
  name: string
  isDefault?: boolean
  materialsReadiness?: MaterialsReadiness | null
}

function KnowledgeBaseRow({
  chatbotId,
  knowledgeBase,
  onAddFiles,
  onDefault,
  onDetach,
  busy,
  showDefaultBadge,
}: {
  chatbotId: string
  knowledgeBase: ConnectedKnowledgeBase
  // Read-only rows omit management actions.
  onAddFiles?: (trigger: HTMLElement | null) => void
  onDefault?: () => void
  onDetach?: () => void
  busy: boolean
  showDefaultBadge?: boolean
}) {
  const t = useTranslations()
  const format = useFormatter()
  const apolloClient = useApolloClient()
  const readiness = knowledgeBase.materialsReadiness
  const { data, startPolling, stopPolling } = useQuery(
    GetKbResourcesWithFailureDetailDocument,
    {
      variables: { kbId: knowledgeBase.id, first: RECENT_RESOURCE_COUNT },
      fetchPolicy: 'cache-and-network',
    }
  )
  const resources = data?.getKbResources.items ?? []
  // Counted over every resource of the knowledge base, not only the listed
  // ones, so a large upload keeps polling until all of it has settled.
  const activeCount = data?.getKbResources.inProgressCount ?? 0
  // The counts come from the chatbot list, so they are refreshed once every
  // resource has finished processing.
  const previousActiveCount = useRef(activeCount)
  useEffect(() => {
    if (activeCount > 0) startPolling(ACTIVE_RESOURCE_POLL_MS)
    else stopPolling()
    if (previousActiveCount.current > 0 && activeCount === 0) {
      void apolloClient.refetchQueries({
        include: [QGetChatbotsInfoWithKnowledgeBasesDocument],
      })
    }
    previousActiveCount.current = activeCount
    return () => stopPolling()
  }, [activeCount, apolloClient, startPolling, stopPolling])

  const [expanded, setExpanded] = useState(false)
  const detailId = useId()
  const actionRef = useRef<HTMLDivElement>(null)
  const kbId = knowledgeBase.kbId ?? knowledgeBase.id
  const actions = [
    ...(onAddFiles
      ? [
          {
            id: 'add',
            label: t('manage.resources.chatbotKnowledgeBaseAddFiles'),
            onClick: () =>
              onAddFiles(actionRef.current?.querySelector('button') ?? null),
            data: { cy: 'chatbot-kb-add-files' },
          },
        ]
      : []),
    ...(onDefault
      ? [
          {
            id: 'default',
            label: t(
              knowledgeBase.isDefault
                ? 'manage.resources.chatbotKnowledgeBaseClearDefault'
                : 'manage.resources.chatbotKnowledgeBaseMakeDefault'
            ),
            onClick: onDefault,
            disabled: busy,
            data: {
              cy: `chatbot-kb-${knowledgeBase.isDefault ? 'clear' : 'set'}-default-${kbId}`,
            },
          },
        ]
      : []),
    ...(onDetach
      ? [
          {
            id: 'detach',
            label: t('manage.resources.chatbotKnowledgeBaseDisconnect'),
            onClick: onDetach,
            disabled: busy,
            data: { cy: `chatbot-kb-detach-${kbId}` },
          },
        ]
      : []),
  ]

  return (
    <tbody className="border-t border-slate-200" data-cy="chatbot-kb-card">
      <tr className={expanded ? 'bg-slate-50' : undefined}>
        <th scope="row" className="py-3 pl-1 pr-2 text-left font-normal">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-controls={detailId}
              aria-label={t('manage.resources.chatbotKnowledgeBaseDetailsFor', {
                name: knowledgeBase.name,
              })}
              className="h-8 w-7 shrink-0 rounded text-slate-600 hover:bg-slate-100 focus-visible:outline-2"
            >
              <FontAwesomeIcon
                icon={faChevronRight}
                className={expanded ? 'rotate-90' : ''}
              />
            </button>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={`/resources/knowledgeBases/${encodeURIComponent(knowledgeBase.id)}?chatbotId=${encodeURIComponent(chatbotId)}`}
                className="text-primary-100 break-words font-semibold hover:underline [overflow-wrap:anywhere]"
                data-cy="chatbot-kb-open"
              >
                <span data-cy="chatbot-enabled-knowledge-base">
                  {knowledgeBase.name}
                </span>
              </Link>
              {showDefaultBadge && knowledgeBase.isDefault && (
                <Badge
                  className="bg-primary-10 text-primary-100"
                  data-cy="chatbot-kb-default-badge"
                >
                  {t('manage.resources.chatbotKnowledgeBaseDefaultBadge')}
                </Badge>
              )}
            </div>
          </div>
        </th>
        <td className="px-2 py-3 text-sm tabular-nums text-slate-700">
          {readiness ? (
            <>
              <span data-cy="chatbot-kb-card-resources">
                {readiness.visibleResourceCount === 0
                  ? t('manage.resources.chatbotKnowledgeBaseNoResources')
                  : t('manage.resources.chatbotKnowledgeBaseReadyCount', {
                      ready: readiness.servingResourceCount,
                      total: readiness.visibleResourceCount,
                    })}
              </span>
              {readiness.processingResourceCount > 0 && (
                <div className="text-xs text-slate-600">
                  {t('manage.resources.chatbotKnowledgeBaseCardProcessing')} ·{' '}
                  {format.number(readiness.processingResourceCount)}
                </div>
              )}
              {readiness.failedResourceCount > 0 && (
                <div className="text-xs font-medium text-red-700">
                  {t('manage.resources.chatbotKnowledgeBaseCardFailed')} ·{' '}
                  {format.number(readiness.failedResourceCount)}
                </div>
              )}
            </>
          ) : (
            '—'
          )}
        </td>
        {onAddFiles && (
          <td className="py-2 pr-1 text-right">
            <div
              ref={actionRef}
              id={`chatbot-kb-actions-${chatbotId}-${kbId}`}
              className="inline-block"
            >
              <Dropdown
                items={actions}
                trigger={
                  <>
                    <span className="sr-only">
                      {t('manage.resources.chatbotKnowledgeBaseActionsFor', {
                        name: knowledgeBase.name,
                      })}
                    </span>
                    <FontAwesomeIcon icon={faEllipsisVertical} />
                  </>
                }
                className={{
                  trigger:
                    'h-9 w-9 rounded-md border-none bg-transparent text-slate-600 hover:bg-slate-100',
                }}
                data={{ cy: `chatbot-kb-actions-${kbId}` }}
              />
            </div>
          </td>
        )}
      </tr>
      <tr id={detailId} hidden={!expanded}>
        <td
          colSpan={onAddFiles ? 3 : 2}
          className="space-y-3 bg-slate-50 px-4 pb-4 pt-2 sm:pl-10"
        >
          <p
            className="text-sm text-slate-600"
            data-cy="chatbot-kb-card-changed"
          >
            {readiness?.lastChangedAt
              ? t('manage.resources.chatbotKnowledgeBaseCardLastChanged', {
                  date: format.dateTime(new Date(readiness.lastChangedAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })
              : t('manage.resources.chatbotKnowledgeBaseCardEmpty')}
          </p>
          {resources.length > 0 ? (
            <div>
              <h5 className="text-sm font-medium text-slate-900">
                {t('manage.resources.chatbotKnowledgeBaseCardRecent')}
              </h5>
              <ul className="mt-2 divide-y divide-slate-100">
                {resources.map((resource) => (
                  <li
                    key={resource.id}
                    className="py-2"
                    data-cy={`chatbot-kb-card-resource-${resource.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={
                          resource.type === KbResourceType.Blob
                            ? faFileLines
                            : faLink
                        }
                        className="h-4 w-4 shrink-0 text-slate-500"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                        {resource.title}
                      </span>
                      {resource.latestIngestionRun ? (
                        <RunStatusBadge
                          status={resource.latestIngestionRun.status}
                          dataCy={`chatbot-kb-card-resource-status-${resource.id}`}
                        />
                      ) : null}
                    </div>
                    {resource.latestIngestionRun?.status ===
                    KbIngestionStatus.Failed ? (
                      <RunStatusMessage
                        status={resource.latestIngestionRun.status}
                        errorCode={resource.latestIngestionRun.errorCode}
                        statusMessage={
                          resource.latestIngestionRun.statusMessage
                        }
                        className="mt-1 pl-6 text-xs text-red-700"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </td>
      </tr>
    </tbody>
  )
}

function ChatbotKnowledgeBaseSetup({
  chatbotId,
  chatbotStatus,
  courseIds,
  connectedKnowledgeBases,
  approvedCustomModes = [],
  draftCustomModes = [],
  perModeKbLinksEnabled,
  connectOnSelect = false,
  proposedKnowledgeBaseName,
  readOnly = false,
}: {
  chatbotId: string
  chatbotStatus: ChatbotStatus
  courseIds: string[]
  connectedKnowledgeBases: ConnectedKnowledgeBase[]
  approvedCustomModes?: {
    key: string
    name: string
    knowledgeBaseLinkId?: string | null
  }[]
  draftCustomModes?: {
    key: string
    name: string
    knowledgeBaseLinkId?: string | null
  }[]
  perModeKbLinksEnabled: boolean
  // The setup page connects on select, shows the knowledge base card, and
  // keeps creating and adding materials on the chatbot.
  connectOnSelect?: boolean
  proposedKnowledgeBaseName?: string
  // Shows the connected knowledge base without ways to change it.
  readOnly?: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const apolloClient = useApolloClient()
  const [selectedKbId, setSelectedKbId] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  // The knowledge base that materials are being added to, either the
  // connected one or one just created here.
  const [addResourceKb, setAddResourceKb] = useState<
    { id: string; name: string } | undefined
  >()
  const [detachTarget, setDetachTarget] = useState<
    ConnectedKnowledgeBase | undefined
  >()
  const addResourceTriggerRef = useRef<HTMLElement | null>(null)
  // A knowledge base created here whose connection failed. It stays listed and
  // selected so the lecturer can retry the connection instead of creating a
  // second knowledge base.
  const [unconnectedKb, setUnconnectedKb] = useState<
    { id: string; name: string } | undefined
  >()
  const { data, error, refetch } = useQuery(GetUserKbsDocument, {
    variables: { first: KB_LIST_PAGE_SIZE },
  })
  const { data: courseData } = useQuery(GetUserCoursesDocument, {
    fetchPolicy: 'cache-first',
  })
  // A knowledge base created for this chatbot is proposed in the language of
  // the chatbot's course. Courses that disagree, or a language the knowledge
  // graph cannot generate in, leave the ordinary proposal in place.
  const courseLanguages = new Set(
    (courseData?.userCourses ?? [])
      .filter(({ id }) => courseIds.includes(id))
      .map(({ language }) => domainGenerationLanguageForLocale(language))
  )
  const proposedLanguage =
    courseLanguages.size === 1 ? [...courseLanguages][0] : undefined
  const [addKbLink, { loading: adding }] = useMutation(
    AddKbLinkToChatbotDocument
  )
  const [attachKb, { loading: attachingLegacy }] = useMutation(
    AttachKbToChatbotDocument
  )
  const [setDefaultKb, { loading: settingDefault }] = useMutation(
    SetChatbotDefaultKbDocument
  )
  const [detachKb, { loading: detaching }] = useMutation(
    DetachKbFromChatbotDocument
  )
  const mutating = adding || attachingLegacy || settingDefault || detaching

  const knowledgeBases = data?.getUserKbsConnection.items ?? []
  const connectedKnowledgeBase = connectedKnowledgeBases[0]
  const connectsOnSelect =
    !perModeKbLinksEnabled &&
    connectOnSelect &&
    chatbotStatus !== ChatbotStatus.Published
  const linkedKnowledgeBaseIds = new Set(
    connectedKnowledgeBases.map(
      (knowledgeBase) => knowledgeBase.kbId ?? knowledgeBase.id
    )
  )
  // A failed connection and a newly created KB stay selectable even when they
  // fall outside the first page of the lecturer's list.
  const additiveSelectItems = [
    ...(unconnectedKb ? [unconnectedKb] : []).filter(
      (knowledgeBase): knowledgeBase is { id: string; name: string } =>
        knowledgeBase != null &&
        !linkedKnowledgeBaseIds.has(knowledgeBase.id) &&
        !knowledgeBases.some(({ id }) => id === knowledgeBase.id)
    ),
    ...knowledgeBases,
  ]
    .filter((knowledgeBase) => !linkedKnowledgeBaseIds.has(knowledgeBase.id))
    .map((knowledgeBase) => ({
      value: knowledgeBase.id,
      label: knowledgeBase.name,
    }))
  const legacySelectItems = [
    ...[connectedKnowledgeBase, unconnectedKb].filter(
      (knowledgeBase): knowledgeBase is { id: string; name: string } =>
        knowledgeBase != null &&
        !knowledgeBases.some(({ id }) => id === knowledgeBase.id)
    ),
    ...knowledgeBases,
  ].map((knowledgeBase) => ({
    value: knowledgeBase.id,
    label: knowledgeBase.name,
  }))
  const selectItems = perModeKbLinksEnabled
    ? additiveSelectItems
    : connectsOnSelect
      ? [
          {
            value: NO_KNOWLEDGE_BASE,
            label: t('manage.resources.chatbotNoKnowledgeBaseOption'),
          },
          ...legacySelectItems,
        ]
      : legacySelectItems
  const selectedValue = perModeKbLinksEnabled
    ? selectedKbId
    : (selectedKbId ??
      connectedKnowledgeBase?.id ??
      (connectsOnSelect ? NO_KNOWLEDGE_BASE : undefined))
  const replacing =
    !perModeKbLinksEnabled &&
    connectedKnowledgeBase != null &&
    selectedValue != null &&
    selectedValue !== connectedKnowledgeBase.id
  const retrying =
    unconnectedKb != null &&
    selectedValue === unconnectedKb.id &&
    selectedValue !== connectedKnowledgeBase?.id
  const canConnect = perModeKbLinksEnabled
    ? selectedKbId != null &&
      !linkedKnowledgeBaseIds.has(selectedKbId) &&
      !mutating
    : selectedValue != null &&
      selectedValue !== NO_KNOWLEDGE_BASE &&
      selectedValue !== connectedKnowledgeBase?.id &&
      !mutating

  const addLink = async (kbId: string) => {
    try {
      if (perModeKbLinksEnabled) {
        await addKbLink({ variables: { kbId, chatbotId }, refetchQueries })
      } else {
        await attachKb({ variables: { kbId, chatbotId }, refetchQueries })
      }
      return true
    } catch (mutationError) {
      console.error('Failed to attach KB to chatbot', mutationError)
      return false
    }
  }

  const connect = async (kbId: string) => {
    if (!(await addLink(kbId))) {
      toast({
        type: 'error',
        message: t('manage.resources.chatbotKnowledgeBaseConnectError'),
      })
      return
    }

    setSelectedKbId(undefined)
    setUnconnectedKb(undefined)
    toast({
      type: 'success',
      message: t('manage.resources.chatbotKnowledgeBaseConnectSuccess'),
    })
  }

  const handleConnect = async () => {
    if (!canConnect || !selectedValue) return
    await connect(selectedValue)
  }

  const handleSelect = (kbId: string) => {
    if (!perModeKbLinksEnabled && kbId === NO_KNOWLEDGE_BASE) {
      setSelectedKbId(undefined)
      if (connectedKnowledgeBase) setDetachTarget(connectedKnowledgeBase)
      return
    }
    setSelectedKbId(kbId)
    if (
      !perModeKbLinksEnabled &&
      connectsOnSelect &&
      kbId !== connectedKnowledgeBase?.id &&
      !mutating
    ) {
      void connect(kbId)
    }
  }

  const handleSetDefault = async (
    knowledgeBase: ConnectedKnowledgeBase | null
  ) => {
    if (mutating) return
    try {
      await setDefaultKb({
        variables: {
          chatbotId,
          kbId: knowledgeBase ? (knowledgeBase.kbId ?? knowledgeBase.id) : null,
        },
        refetchQueries,
      })
      toast({
        type: 'success',
        message: knowledgeBase
          ? t('manage.resources.chatbotKnowledgeBaseDefaultSuccess')
          : t('manage.resources.chatbotKnowledgeBaseDefaultCleared'),
      })
    } catch (mutationError) {
      console.error(
        'Failed to change the default knowledge base',
        mutationError
      )
      toast({
        type: 'error',
        message: t('manage.resources.chatbotKnowledgeBaseDefaultError'),
      })
    }
  }

  const handleDisconnect = async () => {
    if (!detachTarget || mutating) return

    try {
      await detachKb({
        variables: {
          kbId: detachTarget.kbId ?? detachTarget.id,
          chatbotId,
        },
        refetchQueries,
      })
    } catch (mutationError) {
      console.error('Failed to detach KB from chatbot', mutationError)
      toast({
        type: 'error',
        message: t('manage.resources.chatbotKnowledgeBaseDisconnectError'),
      })
      return
    }

    setSelectedKbId(undefined)
    setDetachTarget(undefined)
    toast({
      type: 'success',
      message: t('manage.resources.chatbotKnowledgeBaseDisconnectSuccess'),
    })
  }

  const handleCreated = async (createdKb: { id: string; name: string }) => {
    const { id } = createdKb
    // Every cached page of the lecturer's knowledge-base lists now misses the
    // new entry, including the list on the knowledge-base overview page.
    apolloClient.cache.evict({ fieldName: 'getUserKbsConnection' })
    apolloClient.cache.gc()

    if (!(await addLink(id))) {
      setUnconnectedKb(createdKb)
      setSelectedKbId(id)
      await refetch()
      return
    }

    if (connectOnSelect) {
      setSelectedKbId(undefined)
      // Closing the dialog returns focus to the new knowledge base’s actions.
      addResourceTriggerRef.current = null
      setAddResourceKb(createdKb)
      return
    }

    await router.push(
      `/resources/knowledgeBases/${encodeURIComponent(id)}?chatbotId=${encodeURIComponent(chatbotId)}`
    )
  }

  // New materials change the row’s resource list and the chatbot’s materials counts.
  const refreshMaterials = () =>
    apolloClient.refetchQueries({
      include: [
        QGetChatbotsInfoWithKnowledgeBasesDocument,
        GetKbResourcesWithFailureDetailDocument,
      ],
    })

  const listReadOnly =
    readOnly ||
    (!perModeKbLinksEnabled &&
      connectedKnowledgeBases.some((link) => link.isDefault === false))
  const visibleLinks =
    listReadOnly || perModeKbLinksEnabled
      ? connectedKnowledgeBases
      : connectedKnowledgeBases.slice(0, 1)
  const linkedTable = visibleLinks.length > 0 && (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <table
        className="w-full table-fixed border-collapse text-sm"
        aria-label={t('manage.resources.knowledgeBase')}
      >
        <thead className="bg-slate-50 text-left text-xs text-slate-600">
          <tr>
            <th scope="col" className="py-2 pl-9 font-medium">
              {t('manage.resources.knowledgeBase')}
            </th>
            <th scope="col" className="w-[30%] px-2 py-2 font-medium">
              {t('manage.resources.chatbotKnowledgeBaseCardResources')}
            </th>
            {!listReadOnly && (
              <th scope="col" className="w-11">
                <span className="sr-only">{t('shared.generic.actions')}</span>
              </th>
            )}
          </tr>
        </thead>
        {visibleLinks.map((knowledgeBase) => (
          <KnowledgeBaseRow
            key={knowledgeBase.linkId ?? knowledgeBase.id}
            chatbotId={chatbotId}
            knowledgeBase={knowledgeBase}
            showDefaultBadge={perModeKbLinksEnabled || listReadOnly}
            busy={mutating}
            onAddFiles={
              listReadOnly
                ? undefined
                : (trigger) => {
                    addResourceTriggerRef.current = trigger
                    setAddResourceKb(knowledgeBase)
                  }
            }
            onDefault={
              listReadOnly || !perModeKbLinksEnabled
                ? undefined
                : () =>
                    void handleSetDefault(
                      knowledgeBase.isDefault ? null : knowledgeBase
                    )
            }
            onDetach={
              listReadOnly || !perModeKbLinksEnabled
                ? undefined
                : () => setDetachTarget(knowledgeBase)
            }
          />
        ))}
      </table>
    </div>
  )
  if (listReadOnly) return <div data-cy="chatbot-kb-setup">{linkedTable}</div>

  return (
    <div className="space-y-3" data-cy="chatbot-kb-setup">
      {chatbotStatus === ChatbotStatus.Published ? (
        // Knowledge-base bindings are not part of the chatbot revision, so a
        // change here reaches a published chatbot without review.
        <UserNotification
          type="warning"
          message={t('manage.resources.chatbotKnowledgeBaseLiveChangeNote')}
          data={{ cy: 'chatbot-kb-live-change-note' }}
        />
      ) : null}
      {error ? (
        <UserNotification
          type="error"
          message={t('manage.resources.chatbotKnowledgeBaseListError')}
          data={{ cy: 'chatbot-kb-list-error' }}
        />
      ) : null}
      <div className="flex flex-col items-end gap-3 sm:flex-row">
        <div className="w-full flex-1">
          <SelectField
            label={t('manage.resources.knowledgeBase')}
            items={selectItems}
            value={selectedValue}
            onChange={handleSelect}
            placeholder={t(
              'manage.resources.chatbotKnowledgeBaseSelectPlaceholder'
            )}
            disabled={mutating || selectItems.length === 0}
            data={{ cy: 'chatbot-kb-select' }}
          />
        </div>
        {perModeKbLinksEnabled || !connectsOnSelect || canConnect ? (
          <Button
            primary
            disabled={!canConnect}
            onClick={handleConnect}
            data={{ cy: 'chatbot-kb-connect' }}
          >
            <Button.Label>
              {retrying
                ? t('manage.resources.chatbotKnowledgeBaseRetryConnection')
                : perModeKbLinksEnabled
                  ? t('manage.resources.chatbotKnowledgeBaseAddLink')
                  : replacing
                    ? t('manage.resources.chatbotKnowledgeBaseReplace')
                    : t('manage.resources.chatbotKnowledgeBaseConnect')}
            </Button.Label>
          </Button>
        ) : null}
        {!perModeKbLinksEnabled &&
        connectedKnowledgeBase &&
        !connectsOnSelect ? (
          <Button
            disabled={mutating}
            onClick={() => setDetachTarget(connectedKnowledgeBase)}
            data={{ cy: 'chatbot-kb-disconnect' }}
          >
            <Button.Label>
              {t('manage.resources.chatbotKnowledgeBaseDisconnect')}
            </Button.Label>
          </Button>
        ) : null}
        <Button
          disabled={mutating}
          onClick={() => setCreateOpen(true)}
          data={{ cy: 'chatbot-kb-create' }}
        >
          <Button.Label>{t('kb.create')}</Button.Label>
        </Button>
      </div>
      {unconnectedKb ? (
        <UserNotification
          type="error"
          message={t(
            'manage.resources.chatbotKnowledgeBaseCreatedNotConnected',
            { kbName: unconnectedKb.name }
          )}
          data={{ cy: 'chatbot-kb-created-not-connected' }}
        />
      ) : null}
      {!perModeKbLinksEnabled && replacing && !connectsOnSelect ? (
        <UserNotification
          type="warning"
          message={t(
            'manage.resources.chatbotKnowledgeBaseReplacementWarning',
            {
              kbName: connectedKnowledgeBase?.name ?? '',
            }
          )}
          data={{ cy: 'chatbot-kb-replacement-warning' }}
        />
      ) : null}
      {connectedKnowledgeBases.length === 0 ? (
        <UserNotification data={{ cy: 'chatbot-kb-empty' }}>
          {t('manage.resources.chatbotKnowledgeBaseNoneLinked')}
        </UserNotification>
      ) : (
        <div className="space-y-3">
          {perModeKbLinksEnabled && (
            <p
              className="text-sm text-slate-600"
              data-cy="chatbot-default-change-impact"
            >
              {t('kb.defaultChangeImpact', {
                modes:
                  [
                    ...new Set(
                      [...approvedCustomModes, ...draftCustomModes]
                        .filter((mode) => !mode.knowledgeBaseLinkId)
                        .map((mode) => mode.name)
                    ),
                  ].join(', ') || t('shared.generic.none'),
              })}
            </p>
          )}
          {linkedTable}
        </div>
      )}
      {createOpen ? (
        <CreateKnowledgeBaseModal
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
          proposedLanguage={proposedLanguage}
          proposedName={connectOnSelect ? proposedKnowledgeBaseName : undefined}
        />
      ) : null}
      {addResourceKb ? (
        <KnowledgeBaseAddResourceModal
          kbId={addResourceKb.id}
          kbName={addResourceKb.name}
          triggerRef={addResourceTriggerRef}
          onClose={() => {
            setAddResourceKb(undefined)
            if (!addResourceTriggerRef.current) {
              window.requestAnimationFrame(() =>
                document
                  .getElementById(
                    `chatbot-kb-actions-${chatbotId}-${addResourceKb.id}`
                  )
                  ?.querySelector('button')
                  ?.focus()
              )
            }
          }}
          onResourceCreated={refreshMaterials}
        />
      ) : null}
      {detachTarget ? (
        <Modal
          open
          onClose={() => setDetachTarget(undefined)}
          title={t('manage.resources.chatbotKnowledgeBaseDetachTitle')}
          primaryLabel={t('manage.resources.chatbotKnowledgeBaseDisconnect')}
          primaryButtonStyle="destructive"
          primaryLoading={detaching}
          onPrimaryAction={handleDisconnect}
          secondaryLabel={t('shared.generic.cancel')}
          onSecondaryAction={() => setDetachTarget(undefined)}
          dataContent={{ cy: 'chatbot-kb-detach-modal' }}
          dataPrimaryAction={{ cy: 'confirm-chatbot-kb-detach' }}
          dataSecondaryAction={{ cy: 'cancel-chatbot-kb-detach' }}
        >
          <p>
            {t('manage.resources.chatbotKnowledgeBaseDetachDescription', {
              kbName: detachTarget.name,
            })}
          </p>
          {(() => {
            const linkId = detachTarget.linkId
            const approvedModes = linkId
              ? approvedCustomModes.filter(
                  (mode) => mode.knowledgeBaseLinkId === linkId
                )
              : []
            const draftModes = linkId
              ? draftCustomModes.filter(
                  (mode) => mode.knowledgeBaseLinkId === linkId
                )
              : []
            return (
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  {t(
                    'manage.resources.chatbotKnowledgeBaseDetachApprovedModes',
                    {
                      modes:
                        approvedModes.map((mode) => mode.name).join(', ') ||
                        t('shared.generic.none'),
                    }
                  )}
                </p>
                <p>
                  {t('manage.resources.chatbotKnowledgeBaseDetachDraftModes', {
                    modes:
                      draftModes.map((mode) => mode.name).join(', ') ||
                      t('shared.generic.none'),
                  })}
                </p>
                <p>
                  {t('manage.resources.chatbotKnowledgeBaseDetachConsequence')}
                </p>
              </div>
            )
          })()}
        </Modal>
      ) : null}
    </div>
  )
}

export default ChatbotKnowledgeBaseSetup
