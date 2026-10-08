/**
 * A lecturer-authored chat mode. The key is minted by the server the first time
 * a mode is saved, never changes afterwards, and is what messages persist and
 * MCP bindings match; the name is display text a lecturer may rename freely.
 */
export type ChatbotCustomMode = {
  key: string
  name: string
  description: string | null
  personaText: string | null
}

/** Persisted, platform-constrained set of custom chat modes for one chatbot. */
export type ChatbotCustomModeConfig = {
  modes: ChatbotCustomMode[]
}

/**
 * One custom mode as submitted by the authoring surface. An existing mode is
 * identified by its key; a mode without a key is newly authored and is assigned
 * a key when it is saved.
 */
export type ChatbotCustomModeInput = {
  key?: string | null
  name: string
  description?: string | null
  personaText?: string | null
}

/** Full replacement input accepted by the section-patch save mutation. */
export type ChatbotCustomModeConfigInput = {
  modes: ChatbotCustomModeInput[]
}
