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
  /**
   * Authored interface text for an empty chat. Absent or null means the
   * runtime falls back to its generic greeting; it is never sent to the model.
   */
  welcomeMessage?: string | null
  /**
   * Ordered suggestions offered in an empty chat. Absent, null or empty means
   * the mode offers none; the text is copied into the composer, never sent.
   */
  starterPrompts?: string[] | null
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
  /**
   * Omission keeps the stored welcome of an existing mode; null or blank
   * clears it.
   */
  welcomeMessage?: string | null
  /**
   * Omission keeps the stored starters of an existing mode; null or an empty
   * list clears them.
   */
  starterPrompts?: string[] | null
}

/** Full replacement input accepted by the section-patch save mutation. */
export type ChatbotCustomModeConfigInput = {
  modes: ChatbotCustomModeInput[]
}
