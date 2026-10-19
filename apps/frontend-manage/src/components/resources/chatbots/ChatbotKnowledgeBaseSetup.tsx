import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import { faFileLines, faLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AttachKbToChatbotDocument,
  ChatbotStatus,
  DetachKbFromChatbotDocument,
  GetKbResourcesWithFailureDetailDocument,
  GetUserCoursesDocument,
  GetUserKbsDocument,
  KbIngestionStatus,
  KbResourceStatus,
  KbResourceType,
  QGetChatbotsInfoWithKnowledgeBasesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  CreateKnowledgeBaseModal,
  domainGenerationLanguageForLocale,
  KnowledgeBaseAddResourceModal,
  RunStatusBadge,
  RunStatusMessage,
} from '@klicker-uzh/kb-management'
import {
  Button,
  SelectField,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useFormatter, useTranslations } from 'next-intl'
import { type RefObject, useEffect, useRef, useState } from 'react'

// The largest page the knowledge-base list accepts in one request.
const KB_LIST_PAGE_SIZE = 50

const refetchQueries = [{ query: QGetChatbotsInfoWithKnowledgeBasesDocument }]

// The select value that stands for answering without a knowledge base.
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
  name: string
  materialsReadiness?: MaterialsReadiness | null
}

function KnowledgeBaseCard({
  chatbotId,
  knowledgeBase,
  addFilesRef,
  onAddFiles,
}: {
  chatbotId: string
  knowledgeBase: ConnectedKnowledgeBase
  addFilesRef: RefObject<HTMLDivElement | null>
  onAddFiles: () => void
}) {
  const t = useTranslations()
  const format = useFormatter()
  const apolloClient = useApolloClient()
  const readiness = knowledgeBase.materialsReadiness
  const { data, startPolling, stopPolling } = useQuery(
    GetKbResourcesWithFailureDetailDocument,
    { variables: { kbId: knowledgeBase.id, first: RECENT_RESOURCE_COUNT } }
  )
  const resources = data?.getKbResources.items ?? []
  const activeCount = resources.filter(
    ({ status, latestIngestionRun }) =>
      status === KbResourceStatus.Queued ||
      status === KbResourceStatus.Processing ||
      latestIngestionRun?.status === KbIngestionStatus.Queued ||
      latestIngestionRun?.status === KbIngestionStatus.Processing
  ).length
  // The counts come from the chatbot list, so they are refreshed once the
  // listed resources have finished processing.
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

  const counts = [
    {
      key: 'resources',
      label: t('manage.resources.chatbotKnowledgeBaseCardResources'),
      value: readiness?.visibleResourceCount ?? 0,
    },
    {
      key: 'ready',
      label: t('manage.resources.chatbotKnowledgeBaseCardReady'),
      value: readiness?.servingResourceCount ?? 0,
    },
    {
      key: 'processing',
      label: t('manage.resources.chatbotKnowledgeBaseCardProcessing'),
      value: readiness?.processingResourceCount ?? 0,
    },
    {
      key: 'failed',
      label: t('manage.resources.chatbotKnowledgeBaseCardFailed'),
      value: readiness?.failedResourceCount ?? 0,
    },
  ]

  return (
    <div
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4"
      data-cy="chatbot-kb-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4
            className="break-words font-semibold text-slate-900"
            data-cy="chatbot-enabled-knowledge-base"
          >
            {knowledgeBase.name}
          </h4>
          <p className="mt-1 text-sm text-slate-600">
            {t('manage.resources.chatbotKnowledgeBaseCardReusable')}
          </p>
        </div>
        <Link
          href={`/resources/knowledgeBases/${encodeURIComponent(knowledgeBase.id)}?chatbotId=${encodeURIComponent(chatbotId)}`}
          className="text-primary-100 shrink-0 text-sm hover:underline"
          data-cy="chatbot-kb-open"
        >
          {t('manage.resources.chatbotKnowledgeBaseCardOpen')}
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counts.map(({ key, label, value }) => (
          <div key={key} data-cy={`chatbot-kb-card-${key}`}>
            <dt className="text-xs text-slate-600">{label}</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {format.number(value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-slate-600" data-cy="chatbot-kb-card-changed">
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
                    statusMessage={resource.latestIngestionRun.statusMessage}
                    className="mt-1 pl-6 text-xs text-red-700"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div ref={addFilesRef} className="w-max">
        <Button onClick={onAddFiles} data={{ cy: 'chatbot-kb-add-files' }}>
          <Button.Label>
            {t('manage.resources.chatbotKnowledgeBaseAddFiles')}
          </Button.Label>
        </Button>
      </div>
    </div>
  )
}

function ChatbotKnowledgeBaseSetup({
  chatbotId,
  chatbotStatus,
  courseIds,
  connectedKnowledgeBase,
  connectOnSelect = false,
  proposedKnowledgeBaseName,
}: {
  chatbotId: string
  chatbotStatus: ChatbotStatus
  courseIds: string[]
  connectedKnowledgeBase?: ConnectedKnowledgeBase
  // The setup page connects on select, shows the knowledge base card, and
  // keeps creating and adding materials on the chatbot.
  connectOnSelect?: boolean
  proposedKnowledgeBaseName?: string
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
  const addResourceTriggerRef = useRef<HTMLElement | null>(null)
  const addFilesRef = useRef<HTMLDivElement | null>(null)
  // Bindings sit outside the chatbot revision, so a choice only has a live
  // effect on a published chatbot. Elsewhere the host may connect on select,
  // and choosing no knowledge base is then one of the options instead of a
  // separate Disconnect button.
  const connectsOnSelect =
    connectOnSelect && chatbotStatus !== ChatbotStatus.Published
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
  const [attachKb, { loading: attaching }] = useMutation(
    AttachKbToChatbotDocument
  )
  const [detachKb, { loading: detaching }] = useMutation(
    DetachKbFromChatbotDocument
  )
  const mutating = attaching || detaching

  const knowledgeBases = data?.getUserKbsConnection.items ?? []
  // The connected knowledge base and one just created here stay selectable even
  // when they fall outside the first page of the lecturer's list.
  const selectItems = [
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
  if (connectsOnSelect) {
    selectItems.unshift({
      value: NO_KNOWLEDGE_BASE,
      label: t('manage.resources.chatbotNoKnowledgeBaseOption'),
    })
  }
  const selectedValue =
    selectedKbId ??
    connectedKnowledgeBase?.id ??
    (connectsOnSelect ? NO_KNOWLEDGE_BASE : undefined)
  const replacing =
    connectedKnowledgeBase != null &&
    selectedValue != null &&
    selectedValue !== connectedKnowledgeBase.id
  const retrying =
    unconnectedKb != null &&
    selectedValue === unconnectedKb.id &&
    selectedValue !== connectedKnowledgeBase?.id
  const canConnect =
    selectedValue != null &&
    selectedValue !== NO_KNOWLEDGE_BASE &&
    selectedValue !== connectedKnowledgeBase?.id &&
    !mutating

  const attach = async (kbId: string) => {
    try {
      await attachKb({ variables: { kbId, chatbotId }, refetchQueries })
      return true
    } catch (mutationError) {
      console.error('Failed to attach KB to chatbot', mutationError)
      return false
    }
  }

  const connect = async (kbId: string) => {
    if (!(await attach(kbId))) {
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
    if (kbId === NO_KNOWLEDGE_BASE) {
      setSelectedKbId(undefined)
      void handleDisconnect()
      return
    }
    setSelectedKbId(kbId)
    if (connectsOnSelect && kbId !== connectedKnowledgeBase?.id && !mutating) {
      void connect(kbId)
    }
  }

  const handleDisconnect = async () => {
    if (!connectedKnowledgeBase || mutating) return

    try {
      await detachKb({
        variables: { kbId: connectedKnowledgeBase.id, chatbotId },
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

    if (!(await attach(id))) {
      setUnconnectedKb(createdKb)
      setSelectedKbId(id)
      await refetch()
      return
    }

    if (connectOnSelect) {
      setSelectedKbId(undefined)
      // Closing the dialog leads to the new knowledge base's card.
      addResourceTriggerRef.current = null
      setAddResourceKb(createdKb)
      return
    }

    await router.push(
      `/resources/knowledgeBases/${encodeURIComponent(id)}?chatbotId=${encodeURIComponent(chatbotId)}`
    )
  }

  // New materials change the card's list and the chatbot's materials counts.
  const refreshMaterials = () =>
    apolloClient.refetchQueries({
      include: [
        QGetChatbotsInfoWithKnowledgeBasesDocument,
        GetKbResourcesWithFailureDetailDocument,
      ],
    })

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
        {!connectsOnSelect || canConnect ? (
          // Without a live effect the button only remains to retry a
          // connection that failed.
          <Button
            primary
            disabled={!canConnect}
            onClick={handleConnect}
            data={{ cy: 'chatbot-kb-connect' }}
          >
            <Button.Label>
              {retrying
                ? t('manage.resources.chatbotKnowledgeBaseRetryConnection')
                : replacing
                  ? t('manage.resources.chatbotKnowledgeBaseReplace')
                  : t('manage.resources.chatbotKnowledgeBaseConnect')}
            </Button.Label>
          </Button>
        ) : null}
        {connectedKnowledgeBase && !connectsOnSelect ? (
          <Button
            disabled={mutating}
            onClick={handleDisconnect}
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
      {replacing && !connectsOnSelect ? (
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
      {connectOnSelect && connectedKnowledgeBase ? (
        <KnowledgeBaseCard
          chatbotId={chatbotId}
          knowledgeBase={connectedKnowledgeBase}
          addFilesRef={addFilesRef}
          onAddFiles={() => {
            addResourceTriggerRef.current =
              document.activeElement as HTMLElement
            setAddResourceKb(connectedKnowledgeBase)
          }}
        />
      ) : null}
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
            void refreshMaterials()
            if (!addResourceTriggerRef.current) {
              window.requestAnimationFrame(() =>
                addFilesRef.current?.querySelector('button')?.focus()
              )
            }
          }}
          onResourceCreated={refreshMaterials}
        />
      ) : null}
    </div>
  )
}

export default ChatbotKnowledgeBaseSetup
