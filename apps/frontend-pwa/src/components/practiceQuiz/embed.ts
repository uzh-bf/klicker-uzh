export const EMBED_INIT_MESSAGE_TYPE = 'klicker:embed-init'
export const EMBED_RESIZE_MESSAGE_TYPE = 'klicker:embed-resize'
export const QUIZ_STATE_MESSAGE_TYPE = 'klicker:quiz-state'
export const EMBED_PROTOCOL_VERSION = 1

export type EmbedCapabilities = {
  resize?: boolean
  hostNavigation?: boolean
}

export type EmbedInitMessage = {
  type: typeof EMBED_INIT_MESSAGE_TYPE
  capabilities?: EmbedCapabilities
}

export type EmbedResizePayload = {
  version: typeof EMBED_PROTOCOL_VERSION
  height: number
}

/**
 * Capabilities are negotiated monotonically for the lifetime of one embed.
 * Hosts retry initialization, so a late message must not revoke an earlier
 * capability while the child is already using it.
 */
export function mergeEmbedCapabilities(
  current: EmbedCapabilities,
  requested: EmbedCapabilities
): EmbedCapabilities {
  return {
    resize: current.resize === true || requested.resize === true,
    hostNavigation:
      current.hostNavigation === true || requested.hostNavigation === true,
  }
}

export function isEmbedInitMessage(data: unknown): data is EmbedInitMessage {
  if (!isRecord(data) || data.type !== EMBED_INIT_MESSAGE_TYPE) return false

  if (typeof data.capabilities === 'undefined') return true
  if (!isRecord(data.capabilities)) return false

  return Object.entries(data.capabilities).every(
    ([key, value]) =>
      (key === 'resize' || key === 'hostNavigation') &&
      typeof value === 'boolean'
  )
}

export function isValidEmbedResizePayload(
  data: unknown
): data is EmbedResizePayload {
  return (
    isRecord(data) &&
    data.version === EMBED_PROTOCOL_VERSION &&
    typeof data.height === 'number' &&
    Number.isFinite(data.height) &&
    data.height >= 200 &&
    data.height <= 50000
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
