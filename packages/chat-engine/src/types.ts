// The engine's input contract for a Klicker chatbot row. The consuming service
// (apps/chat-api) builds this from Prisma; the engine itself touches no DB and
// owns no persistence — it is a pure agent/provider/guardrail/cost library.
export type ChatbotConfig = {
  id: string
  name: string
  courseId: string | null
  systemPrompts: Record<string, { prompt: string; description?: string }> | null
  allowedModelIds: string[]
  modelSelection: boolean
  openaiApiKey: string | null
  openaiBaseUrl: string | null
}
