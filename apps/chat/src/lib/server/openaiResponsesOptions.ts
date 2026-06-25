const TRUTHY_VALUES = new Set(['true', '1', 'yes', 'on'])

export function parseOpenAIResponsesStore(value: string | undefined): boolean {
  if (!value) return false
  return TRUTHY_VALUES.has(value.trim().toLowerCase())
}

export function getOpenAIResponsesStore(): boolean {
  return parseOpenAIResponsesStore(process.env.CHAT_OPENAI_STORE_RESPONSES)
}
