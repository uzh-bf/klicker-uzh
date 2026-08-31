import type { ParsedUrlQuery } from 'node:querystring'
import { useQuery } from '@apollo/client'
import {
  type Chatbot,
  type ChatModelCapability,
  GetChatbotPublishingCapabilityDocument,
  GetChatbotsInfoDocument,
  GetChatModelRegistryDocument,
  GetUserCoursesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ChatbotCreateModal from './chatbots/ChatbotCreateModal'
import ChatbotDetails from './chatbots/ChatbotDetails'
import ChatbotList from './chatbots/ChatbotList'
import { getChatbotStatusTranslationKey } from './chatbots/chatbotStatus'
import {
  type ChatbotNavigationState,
  type ChatbotSetupStep,
  type ChatbotWorkspaceState,
  type ChatbotWorkspaceView,
  normalizeWorkspaceState,
} from './chatbots/chatbotWorkspace'
import useChatbotNavigationGuard from './chatbots/useChatbotNavigationGuard'

const cleanNavigationState: ChatbotNavigationState = {
  dirty: false,
  pending: false,
}

function Chatbots() {
  const t = useTranslations()
  const router = useRouter()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [navigationState, setNavigationState] =
    useState<ChatbotNavigationState>(cleanNavigationState)
  const { data, loading } = useQuery(GetChatbotsInfoDocument, {
    fetchPolicy: 'network-only',
  })
  const { data: modelRegistryData, loading: modelRegistryLoading } = useQuery(
    GetChatModelRegistryDocument,
    {
      fetchPolicy: 'cache-first',
    }
  )
  const { data: courseData } = useQuery(GetUserCoursesDocument, {
    fetchPolicy: 'cache-first',
  })
  const {
    data: publishingCapabilityData,
    loading: publishingCapabilityLoading,
    error: publishingCapabilityError,
  } = useQuery(GetChatbotPublishingCapabilityDocument, {
    fetchPolicy: 'network-only',
  })

  const chatbots = data?.getChatbotsInfo ?? []
  const modelRegistry: ChatModelCapability[] =
    modelRegistryData?.getChatModelRegistry ?? []
  const selectedId =
    typeof router.query?.chatbotId === 'string'
      ? router.query.chatbotId
      : undefined
  const selectedChatbot =
    chatbots.find((chatbot) => chatbot.id === selectedId) ?? chatbots[0]
  const requestedView =
    typeof router.query?.view === 'string' ? router.query.view : undefined
  const requestedStep =
    typeof router.query?.step === 'string' ? router.query.step : undefined
  const workspaceState = useMemo<ChatbotWorkspaceState>(
    () =>
      selectedChatbot
        ? normalizeWorkspaceState(selectedChatbot, requestedView, requestedStep)
        : { view: 'overview' },
    [requestedStep, requestedView, selectedChatbot]
  )
  const ownedCourses = (courseData?.userCourses ?? []).filter(
    (course) => course.isOwner && !course.isArchived
  )

  const { confirmNavigation, runInternalNavigation, runNavigation } =
    useChatbotNavigationGuard({
      router,
      state: navigationState,
      discardMessage: t('manage.resources.chatbotDiscardChangesConfirmation'),
      pendingMessage: t('manage.resources.chatbotNavigationPending'),
    })

  const buildWorkspaceQuery = useCallback(
    (chatbotId: string, state: ChatbotWorkspaceState) => {
      const query: ParsedUrlQuery = {
        ...router.query,
        chatbotId,
        view: state.view,
      }
      if (state.step) {
        query.step = state.step
      } else {
        delete query.step
      }
      return query
    },
    [router.query]
  )

  useEffect(() => {
    if (!router.isReady || loading || !selectedChatbot) return

    const queryIsCanonical =
      selectedId === selectedChatbot.id &&
      requestedView === workspaceState.view &&
      requestedStep === workspaceState.step
    if (queryIsCanonical) return

    runInternalNavigation(() =>
      router.replace(
        {
          pathname: router.pathname,
          query: buildWorkspaceQuery(selectedChatbot.id, workspaceState),
        },
        undefined,
        { shallow: true }
      )
    )
  }, [
    loading,
    buildWorkspaceQuery,
    requestedStep,
    requestedView,
    router,
    router.isReady,
    runInternalNavigation,
    selectedChatbot,
    selectedId,
    workspaceState,
  ])

  const selectChatbot = (chatbotId: string, internal = false) => {
    if (chatbotId === selectedChatbot?.id) return
    const chatbot = chatbots.find((item) => item.id === chatbotId)
    if (!chatbot) return
    const nextState = normalizeWorkspaceState(chatbot, undefined, undefined)
    const navigate = () => {
      setNavigationState(cleanNavigationState)
      return router.push(
        {
          pathname: router.pathname,
          query: buildWorkspaceQuery(chatbotId, nextState),
        },
        undefined,
        { shallow: true }
      )
    }
    if (internal) {
      runInternalNavigation(navigate)
    } else {
      runNavigation(navigate)
    }
  }

  const navigateWorkspace = (
    view: ChatbotWorkspaceView,
    step?: ChatbotSetupStep
  ) => {
    if (!selectedChatbot) return
    if (
      view === workspaceState.view &&
      (view !== 'setup' || step === workspaceState.step)
    ) {
      return
    }
    const nextState = normalizeWorkspaceState(selectedChatbot, view, step)
    runNavigation(() => {
      setNavigationState(cleanNavigationState)
      return router.push(
        {
          pathname: router.pathname,
          query: buildWorkspaceQuery(selectedChatbot.id, nextState),
        },
        undefined,
        { shallow: true }
      )
    })
  }

  const handleSelect = (chatbot: Chatbot) => selectChatbot(chatbot.id)

  const selectCreatedChatbot = (chatbotId: string) => {
    runInternalNavigation(() => {
      setNavigationState(cleanNavigationState)
      return router.push(
        {
          pathname: router.pathname,
          query: buildWorkspaceQuery(chatbotId, {
            view: 'setup',
            step: 'disclaimer',
          }),
        },
        undefined,
        { shallow: true }
      )
    })
  }

  const openCreateModal = () => {
    if (!confirmNavigation()) return
    setNavigationState(cleanNavigationState)
    setCreateModalOpen(true)
  }

  return (
    <div className="h-full w-full">
      <H2>{t('manage.resources.chatbots')}</H2>
      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white lg:flex lg:min-h-[42rem]">
        <div className="border-b border-gray-200 p-4 lg:hidden">
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-sm font-medium text-gray-700">
              <span className="mb-1 block">
                {t('manage.resources.chatbotMobileSelector')}
              </span>
              <select
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                data-cy="chatbot-mobile-selector"
                value={selectedChatbot?.id ?? ''}
                onChange={(event) => selectChatbot(event.target.value)}
              >
                {chatbots.map((chatbot) => (
                  <option key={chatbot.id} value={chatbot.id}>
                    {chatbot.name} ·{' '}
                    {t(getChatbotStatusTranslationKey(chatbot.status))}
                  </option>
                ))}
              </select>
            </label>
            <Button
              primary
              onClick={openCreateModal}
              data={{ cy: 'create-chatbot-mobile' }}
            >
              <Button.Label>
                {t('manage.resources.createChatbotShort')}
              </Button.Label>
            </Button>
          </div>
        </div>
        <aside className="hidden w-80 shrink-0 border-r border-gray-200 bg-gray-50 p-4 lg:block">
          <ChatbotList
            chatbots={chatbots}
            loading={loading}
            selectedId={selectedChatbot?.id}
            onSelect={handleSelect}
            onCreate={openCreateModal}
          />
        </aside>
        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <ChatbotDetails
            chatbot={selectedChatbot}
            modelRegistry={modelRegistry}
            loading={loading || modelRegistryLoading}
            view={workspaceState.view}
            step={workspaceState.step}
            onNavigate={navigateWorkspace}
            onNavigationStateChange={setNavigationState}
            publishingAuthorized={
              publishingCapabilityData?.getChatbotPublishingCapability ?? false
            }
            publishingAuthorizationLoading={publishingCapabilityLoading}
            publishingAuthorizationError={Boolean(publishingCapabilityError)}
          />
        </main>
      </div>
      {createModalOpen ? (
        <ChatbotCreateModal
          courses={ownedCourses}
          onClose={() => setCreateModalOpen(false)}
          onCreated={(chatbotId) => {
            setCreateModalOpen(false)
            selectCreatedChatbot(chatbotId)
          }}
        />
      ) : null}
    </div>
  )
}

export default Chatbots
