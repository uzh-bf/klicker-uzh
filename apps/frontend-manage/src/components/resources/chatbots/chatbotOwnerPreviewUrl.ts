export function buildChatbotOwnerPreviewUrl({
  chatbotId,
  chatUrl,
}: {
  chatbotId: string
  chatUrl?: string
}): string | null {
  if (!chatUrl) return null

  return `${chatUrl.replace(/\/$/, '')}/preview/${encodeURIComponent(chatbotId)}`
}

export function buildChatbotConversationExportUrl({
  chatbotId,
  chatUrl,
  format,
}: {
  chatbotId: string
  chatUrl?: string
  format: 'index' | 'transcripts' | 'json'
}): string | null {
  if (!chatUrl) return null

  return `${chatUrl.replace(/\/$/, '')}/api/manage/chatbots/${encodeURIComponent(chatbotId)}/export?format=${format}`
}
