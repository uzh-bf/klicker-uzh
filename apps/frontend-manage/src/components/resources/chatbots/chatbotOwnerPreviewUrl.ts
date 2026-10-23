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
