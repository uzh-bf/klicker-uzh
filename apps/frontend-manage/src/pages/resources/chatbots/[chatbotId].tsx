import { useQuery } from '@apollo/client'
import {
  GetChatbotsInfoDocument,
  GetChatbotPublishingCapabilityDocument,
  GetChatModelRegistryDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Select,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import AiBetaUnavailable from '../../../components/AiBetaUnavailable'
import ChatbotDetails from '../../../components/resources/chatbots/ChatbotDetails'
import {
  type ChatbotNavigationState,
  type ChatbotSetupStep,
  type ChatbotWorkspaceState,
  type ChatbotWorkspaceView,
  normalizeWorkspaceState,
} from '../../../components/resources/chatbots/chatbotWorkspace'
import useChatbotNavigationGuard from '../../../components/resources/chatbots/useChatbotNavigationGuard'
import Layout from '../../../components/Layout'
import { useAiFeaturesEnabled } from '../../../lib/hooks/useAiFeaturesEnabled'

const cleanNavigationState: ChatbotNavigationState = {
  dirty: false,
  pending: false,
}

function ChatbotDetailPage() {
  const t = useTranslations()
  const router = useRouter()
  const aiFeaturesEnabled = useAiFeaturesEnabled()
  const chatbotId = router.query.chatbotId
  const [navigationState, setNavigationState] =
    useState<ChatbotNavigationState>(cleanNavigationState)

  const { data, loading } = useQuery(GetChatbotsInfoDocument, {
    fetchPolicy: 'network-only',
    skip: !aiFeaturesEnabled || typeof chatbotId !== 'string',
  })
  const registryQuery = useQuery(GetChatModelRegistryDocument, {
    fetchPolicy: 'cache-first',
    skip: !aiFeaturesEnabled,
  })
  const {
    data: publishingCapabilityData,
    loading: publishingCapabilityLoading,
    error: publishingCapabilityError,
  } = useQuery(GetChatbotPublishingCapabilityDocument, {
    fetchPolicy: 'network-only',
    skip: !aiFeaturesEnabled,
  })

  const chatbots = data?.getChatbotsInfo ?? []
  const chatbot =
    typeof chatbotId === 'string'
      ? chatbots.find((candidate) => candidate.id === chatbotId)
      : undefined
  const requestedView =
    typeof router.query?.view === 'string' ? router.query.view : undefined
  const requestedStep =
    typeof router.query?.step === 'string' ? router.query.step : undefined
  const workspaceState = useMemo<ChatbotWorkspaceState>(
    () =>
      chatbot
        ? normalizeWorkspaceState(chatbot, requestedView, requestedStep)
        : { view: 'overview' },
    [chatbot, requestedStep, requestedView]
  )

  const { runInternalNavigation, runNavigation } = useChatbotNavigationGuard({
    router,
    state: navigationState,
    discardMessage: t('manage.resources.chatbotDiscardChangesConfirmation'),
    pendingMessage: t('manage.resources.chatbotNavigationPending'),
  })

  const navigateWorkspace = (
    view: ChatbotWorkspaceView,
    step?: ChatbotSetupStep,
    internal = false
  ) => {
    if (!chatbot) return
    const query: Record<string, string> = { chatbotId: chatbot.id, view }
    if (step) {
      query.step = step
    }
    const navigate = () =>
      router.push({ pathname: router.pathname, query }, undefined, {
        shallow: true,
      })
    if (internal) {
      void runInternalNavigation(navigate)
    } else {
      void runNavigation(navigate)
    }
  }

  return (
    <Layout displayName={chatbot?.name ?? t('manage.resources.chatbots')}>
      {aiFeaturesEnabled ? (
        <>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/resources/chatbots">
                    {t('manage.resources.chatbots')}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {loading || !chatbot ? (
                  <BreadcrumbPage>
                    {loading
                      ? t('shared.generic.loading')
                      : t('manage.resources.chatbotDetails')}
                  </BreadcrumbPage>
                ) : (
                  <Select
                    value={chatbot.id}
                    onChange={(value) =>
                      void router.push(
                        `/resources/chatbots/${encodeURIComponent(value)}`
                      )
                    }
                    placeholder={t('manage.resources.switchChatbot')}
                    contentPosition="popper"
                    items={chatbots.map((candidate) => ({
                      value: candidate.id,
                      label: candidate.name,
                    }))}
                    data={{ cy: 'chatbot-switcher' }}
                    className={{
                      root: 'inline-flex',
                      trigger: [
                        'h-auto w-auto max-w-64 gap-1 rounded-md border-0',
                        'bg-transparent -mx-1 px-1 py-0.5 text-left text-sm',
                        'font-normal text-foreground shadow-none',
                        'hover:bg-accent hover:text-accent-foreground',
                        'focus-visible:border-0 focus-visible:ring-1',
                        'data-[state=open]:bg-accent',
                        'data-[state=open]:text-accent-foreground',
                        'dark:bg-transparent dark:hover:bg-accent',
                        '[&>svg]:size-3.5',
                      ].join(' '),
                      content: 'min-w-48',
                    }}
                  />
                )}
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <h1 className="text-2xl font-bold">
            {loading
              ? t('shared.generic.loading')
              : (chatbot?.name ?? t('manage.resources.chatbotDetails'))}
          </h1>

          {!loading && !chatbot && (
            <UserNotification className={{ root: 'mt-6' }} type="error">
              {t('manage.resources.chatbotNotFound')}
            </UserNotification>
          )}

          {(loading || chatbot) && (
            <div className="mt-6">
              <ChatbotDetails
                chatbot={chatbot}
                modelRegistry={registryQuery.data?.getChatModelRegistry ?? []}
                loading={loading || registryQuery.loading}
                view={workspaceState.view}
                step={workspaceState.step}
                onNavigate={navigateWorkspace}
                onNavigationStateChange={setNavigationState}
                publishingAuthorized={
                  publishingCapabilityData?.getChatbotPublishingCapability ??
                  false
                }
                publishingAuthorizationLoading={publishingCapabilityLoading}
                publishingAuthorizationError={Boolean(
                  publishingCapabilityError
                )}
              />
            </div>
          )}
        </>
      ) : (
        <AiBetaUnavailable />
      )}
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export async function getStaticPaths() {
  return { paths: [], fallback: 'blocking' }
}

export default ChatbotDetailPage
