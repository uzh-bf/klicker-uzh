import { ChatbotStatus } from '@klicker-uzh/graphql/dist/ops'

export function getChatbotStatusTranslationKey(status: ChatbotStatus) {
  switch (status) {
    case ChatbotStatus.Draft:
      return 'manage.resources.chatbotStatusDraft'
    case ChatbotStatus.PendingApproval:
      return 'manage.resources.chatbotStatusPendingApproval'
    case ChatbotStatus.Published:
      return 'manage.resources.chatbotStatusPublished'
    case ChatbotStatus.Paused:
      return 'manage.resources.chatbotStatusPaused'
    case ChatbotStatus.Rejected:
      return 'manage.resources.chatbotStatusRejected'
    default:
      return 'manage.resources.chatbotStatusUnknown'
  }
}
