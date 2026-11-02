// Fence *syntax* only: the marker shape used to delimit lecturer MCP tool
// results (extension roadmap X4) plus the inverse operation.
//
// Deliberately separate from `toolOutputFencing.ts`: the fenced text is
// streamed to the browser as well as to the model, so client components need
// to read it back. That module imports `node:crypto` for sentinel generation
// and must not end up in a client bundle — this one has no imports at all.
//
// One module owns the marker shape so the writer (server, fencing) and the
// reader (client, proposal card) cannot drift apart.

const FENCE_OPEN_TAG = 'KLICKER_TOOL_DATA'
const FENCE_CLOSE_TAG = 'END_KLICKER_TOOL_DATA'

export function openFenceMarker(sentinel: string): string {
  return `<<<${FENCE_OPEN_TAG} ${sentinel}>>>`
}

export function closeFenceMarker(sentinel: string): string {
  return `<<<${FENCE_CLOSE_TAG} ${sentinel}>>>`
}

// Anchored, and the closing sentinel must equal the opening one (backreference)
// so only a genuine envelope written by `fenceToolResultText` is unwrapped.
// Fence look-alikes *inside* the payload are already structurally defused
// before wrapping, so the outer pair is unambiguous.
const FENCE_ENVELOPE_PATTERN = new RegExp(
  `^<<<${FENCE_OPEN_TAG} (\\S+)>>>\\n([\\s\\S]*)\\n<<<${FENCE_CLOSE_TAG} \\1>>>$`
)

/**
 * Returns the payload inside a tool-result fence, or the input unchanged when
 * it is not a fenced envelope. Machine consumers of tool output (the proposal
 * card parser) must call this before parsing; the fence is a boundary marker
 * for the model, not part of the data.
 */
export function unfenceToolResultText(text: string): string {
  return FENCE_ENVELOPE_PATTERN.exec(text)?.[2] ?? text
}
