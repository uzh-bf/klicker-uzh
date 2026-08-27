import { useQuery } from '@apollo/client'
import {
  type Chatbot,
  type ChatModelCapability,
  GetChatAccountUsageDocument,
  GetChatbotsInfoDocument,
  GetChatModelRegistryDocument,
  GetUserCoursesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ChatbotCreateModal from './chatbots/ChatbotCreateModal'
import ChatbotDetails from './chatbots/ChatbotDetails'
import ChatbotList from './chatbots/ChatbotList'

function Chatbots() {
  const t = useTranslations()
  const router = useRouter()
  const [createModalOpen, setCreateModalOpen] = useState(false)
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
    data: accountUsageData,
    loading: accountUsageLoading,
    error: accountUsageError,
  } = useQuery(GetChatAccountUsageDocument, {
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
  const ownedCourses = (courseData?.userCourses ?? []).filter(
    (course) => course.isOwner && !course.isArchived
  )

  const selectChatbot = (chatbotId: string) => {
    void router.push(
      {
        pathname: router.pathname,
        query: { ...router.query, chatbotId },
      },
      undefined,
      { shallow: true }
    )
  }

  const handleSelect = (chatbot: Chatbot) => selectChatbot(chatbot.id)

  return (
    <div className="h-full w-full">
      <H2>{t('manage.resources.chatbots')}</H2>
      <div className="mt-6 flex flex-col lg:flex-row-reverse">
        <div className="lg:w-1/2 lg:border-l lg:pl-4">
          <ChatbotDetails
            chatbot={selectedChatbot}
            modelRegistry={modelRegistry}
            loading={loading || modelRegistryLoading}
            publishingAuthorized={
              accountUsageData?.getChatAccountUsage?.authorized ?? false
            }
            publishingAuthorizationLoading={accountUsageLoading}
            publishingAuthorizationError={Boolean(accountUsageError)}
          />
        </div>
        <div className="lg:w-1/2 lg:pr-4">
          <ChatbotList
            chatbots={chatbots}
            loading={loading}
            selectedId={selectedChatbot?.id}
            onSelect={handleSelect}
            onCreate={() => setCreateModalOpen(true)}
          />
        </div>
      </div>
      {createModalOpen ? (
        <ChatbotCreateModal
          courses={ownedCourses}
          onClose={() => setCreateModalOpen(false)}
          onCreated={(chatbotId) => {
            setCreateModalOpen(false)
            selectChatbot(chatbotId)
          }}
        />
      ) : null}
    </div>
  )
}

export default Chatbots
