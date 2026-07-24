import { expect, type FrameLocator, type Page } from '@playwright/test'

/**
 * Manage assistant (apps/chat `/manage`, embedded in frontend-manage via
 * ManageAssistantWidget) E2E helpers.
 *
 * The manage assistant is authenticated via the shared `next-auth.session-token`
 * cookie (see apps/chat/src/lib/server/manageAuth.ts) rather than the
 * participant `participant_token` cookie used by the student chatbot (see
 * chat.ts) — tests drive it through the real frontend-manage page and its
 * embedded iframe rather than visiting apps/chat directly, so that the
 * postMessage handshake between the two windows (manage context in,
 * `klicker:manage-element-created` out) exercises real code end to end.
 *
 * Only the LLM endpoint (POST /api/manage/chat) and the proposal confirmation
 * endpoint (POST /api/manage/proposals/confirm) are mocked.
 */

/**
 * Serialize UI-message-stream events as an AI SDK v5 SSE body.
 *
 * The manage assistant uses the stock AI SDK DefaultChatTransport (via
 * AssistantChatTransport in manage-assistant.tsx), whose SSE reader requires
 * events separated by a blank line (`\n\n`) and the
 * `x-vercel-ai-ui-message-stream` marker header (set by the callers below).
 * This is stricter than the student chatbot's lenient custom parser in chat.ts,
 * which accepts single-newline lines with no marker header — hence this helper
 * cannot reuse chat.ts makeStreamBody.
 */
function sseBody(events: Record<string, unknown>[]) {
  return (
    [...events.map((e) => `data: ${JSON.stringify(e)}`), 'data: [DONE]'].join(
      '\n\n'
    ) + '\n\n'
  )
}

/** Wrap payload events in the shared start/step/finish envelope. */
function stepStreamBody(events: Record<string, unknown>[]) {
  return sseBody([
    { type: 'start' },
    { type: 'start-step' },
    ...events,
    { type: 'finish-step' },
    { type: 'finish' },
  ])
}

/** Plain assistant-text UI-message-stream body */
function textStreamBody(text: string) {
  const id = 'e2e-text-1'
  return stepStreamBody([
    { id, type: 'text-start' },
    { delta: text, id, type: 'text-delta' },
    { id, type: 'text-end' },
  ])
}

// Real MCP tool name for the signed create-draft-question proposal (see
// apps/chat/src/components/tool-labels.ts TOOL_LABELS).
export const MANAGE_PROPOSAL_TOOL_NAME =
  'klicker_lecturer_element_create_draft_proposal'

export type ManageProposalEnvelope = {
  kind: 'element.create.proposal'
  proposalToken?: string
  summary?: string
  requiresConfirmation: boolean
  payload: unknown
}

// Valid single-choice draft payload (see
// apps/chat/src/services/manageProposalSchema.ts choicesProposalPayloadSchema)
// so the card's ManageProposalPreview renders a real StudentElement question
// preview instead of falling back to raw JSON.
const DEFAULT_PROPOSAL_PAYLOAD = {
  basePoints: true,
  content: 'What is the powerhouse of the cell?',
  name: 'Powerhouse of the cell',
  options: {
    choices: [
      { correct: true, ix: 0, value: 'Mitochondria' },
      { correct: false, ix: 1, value: 'Nucleus' },
    ],
    displayMode: 'LIST',
    hasAnswerFeedbacks: false,
    hasSampleSolution: true,
  },
  pointsMultiplier: 1,
  status: 'DRAFT',
  tags: [],
  type: 'SC',
}

export function makeProposalEnvelope(
  overrides: Partial<ManageProposalEnvelope> = {}
): ManageProposalEnvelope {
  return {
    kind: 'element.create.proposal',
    payload: DEFAULT_PROPOSAL_PAYLOAD,
    proposalToken: 'e2e-signed-proposal-token',
    requiresConfirmation: true,
    // Deliberately distinct from payload.content above: the card renders
    // both the summary (header) and the question preview (body), and tests
    // assert each independently — an overlapping substring would make the
    // text locators ambiguous.
    summary: 'New single-choice question ready for review',
    ...overrides,
  }
}

// Tool-call UI-message-stream body shaped like a real MCP result: the
// envelope arrives as JSON text inside an MCP `content` array (see
// apps/chat/test/manage-proposal-card.test.ts and
// getManageProposalResult/isManageProposalResult in
// apps/chat/src/components/manage-proposal-card.tsx, which unwrap this shape
// before falling back to a direct envelope object).
function toolCallStreamBody(envelope: ManageProposalEnvelope) {
  const toolCallId = 'e2e-manage-proposal-call-1'
  const mcpResult = {
    content: [{ text: JSON.stringify(envelope), type: 'text' }],
    isError: false,
  }

  return stepStreamBody([
    {
      toolCallId,
      toolName: MANAGE_PROPOSAL_TOOL_NAME,
      type: 'tool-input-start',
    },
    {
      input: { topic: 'cell biology' },
      toolCallId,
      toolName: MANAGE_PROPOSAL_TOOL_NAME,
      type: 'tool-input-available',
    },
    {
      output: mcpResult,
      toolCallId,
      type: 'tool-output-available',
    },
  ])
}

export type ManageChatStreamErrorMode =
  | 'http-500'
  | 'stream-error'
  | 'malformed'

/**
 * Build the fulfillment for a broken POST /api/manage/chat response.
 *
 * - 'http-500': the request fails outright before any stream starts (e.g. the
 *   real route throwing before `toUIMessageStreamResponse`). HttpChatTransport
 *   reads a non-ok response and throws `Error(await response.text())` (see
 *   `ai`'s `src/ui/http-chat-transport.ts`), so `errorText` becomes the thrown
 *   error's message.
 * - 'stream-error': a normal 200 SSE response starts and streams one real
 *   text-delta chunk (so the client has already received partial data), then
 *   an in-band `{type: 'error'}` UI-message-stream chunk aborts the turn — the
 *   documented mechanism for a provider failing mid-turn (see `ai`'s
 *   `src/ui/process-ui-message-stream.ts`, `case 'error'`, which rethrows and
 *   is caught by `Chat`'s send loop, setting `status: 'error'`).
 * - 'malformed': the SSE body's first `data:` line is not valid JSON, so
 *   DefaultChatTransport's `safeParseJSON` fails and its wrapping
 *   TransformStream throws `chunk.error` (see `ai`'s
 *   `src/ui/default-chat-transport.ts`) before any chunk is ever applied to
 *   the message — the client-side "server sent garbage" path.
 *
 * All three end up in the same place from the UI's perspective: `Chat`'s send
 * loop catches the thrown error and sets `status: 'error'`, which is not one
 * of the "running" statuses (`submitted`/`streaming`) that
 * `useAISDKRuntime` treats as busy — so the composer's send affordance
 * returns to normal and the assistant can be asked again.
 */
function errorStreamFulfillment(
  mode: ManageChatStreamErrorMode,
  errorText: string
): { body: string; headers: Record<string, string>; status: number } {
  if (mode === 'http-500') {
    return {
      body: errorText,
      headers: { 'content-type': 'text/plain' },
      status: 500,
    }
  }

  if (mode === 'malformed') {
    return {
      body: 'data: {this is not valid json\n\n',
      headers: {
        'content-type': 'text/event-stream',
        'x-vercel-ai-ui-message-stream': 'v1',
      },
      status: 200,
    }
  }

  // 'stream-error'
  const id = 'e2e-stream-error-1'
  const events = [
    { type: 'start' },
    { type: 'start-step' },
    { id, type: 'text-start' },
    {
      delta: 'Partial answer before the connection dropped.',
      id,
      type: 'text-delta',
    },
    { errorText, type: 'error' },
  ]
  return {
    // Deliberately no finish-step/finish/[DONE]: a real mid-stream failure
    // ends the response without a clean close.
    body: events.map((e) => `data: ${JSON.stringify(e)}`).join('\n\n') + '\n\n',
    headers: {
      'content-type': 'text/event-stream',
      'x-vercel-ai-ui-message-stream': 'v1',
    },
    status: 200,
  }
}

/**
 * Mock the manage assistant's LLM endpoint (POST /api/manage/chat).
 *
 * `mode: 'text'` (default) replies with a plain streamed text reply.
 * `mode: 'proposal'` replies with a signed create-draft-question tool call
 * shaped like the real lecturer MCP tool result.
 *
 * `errorMode` serves a broken response (see `errorStreamFulfillment` above)
 * for the first matching request only; every later request on the same route
 * falls back to the normal `mode` reply, so a test can assert the assistant
 * recovers and accepts a new message after the failure.
 */
export async function mockManageChatStream(
  page: Page,
  {
    mode = 'text',
    text = 'This is a mocked assistant reply.',
    envelope,
    errorMode,
    errorText = 'The assistant is temporarily unavailable. Please try again.',
  }: {
    mode?: 'text' | 'proposal'
    text?: string
    envelope?: ManageProposalEnvelope
    errorMode?: ManageChatStreamErrorMode
    errorText?: string
  } = {}
) {
  let errorServed = false

  // Route at the browser-context level: the request originates inside the
  // cross-origin chat iframe (an out-of-process frame), which page.route on the
  // top-level manage page does not reliably intercept.
  await page.context().route('**/api/manage/chat', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()

    if (errorMode && !errorServed) {
      errorServed = true
      return route.fulfill(errorStreamFulfillment(errorMode, errorText))
    }

    const body =
      mode === 'proposal'
        ? toolCallStreamBody(envelope ?? makeProposalEnvelope())
        : textStreamBody(text)

    return route.fulfill({
      body,
      headers: {
        'content-type': 'text/event-stream',
        // Marker header the AI SDK DefaultChatTransport requires to parse the
        // response as a UI message stream (set by toUIMessageStreamResponse on
        // the real route).
        'x-vercel-ai-ui-message-stream': 'v1',
      },
      status: 200,
    })
  })
}

export type ConfirmedManageElement = { id: number; name: string }

export const DEFAULT_CONFIRMED_ELEMENT: ConfirmedManageElement = {
  id: 4242,
  name: 'Powerhouse of the cell',
}

/** A rejected proposal confirmation, e.g. a tampered/expired token (403) or a
 * lost session (401). `error` is returned verbatim in the JSON body's
 * `error` field, which confirmProposal() in manage-proposal-card.tsx reads
 * and renders as-is on a non-ok response. */
export type ManageProposalConfirmError = {
  status: number
  error: string
}

/**
 * Mock the proposal confirmation endpoint (POST /api/manage/proposals/confirm).
 *
 * Defaults to a 200 success response resolving `DEFAULT_CONFIRMED_ELEMENT`.
 * Pass a `{status, error}` object instead to simulate a rejected
 * confirmation.
 */
export async function mockManageProposalConfirm(
  page: Page,
  outcome:
    | ConfirmedManageElement
    | ManageProposalConfirmError = DEFAULT_CONFIRMED_ELEMENT
) {
  // Context-level route: same cross-origin iframe reason as mockManageChatStream.
  await page.context().route('**/api/manage/proposals/confirm', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()

    if ('status' in outcome) {
      return route.fulfill({
        body: JSON.stringify({ error: outcome.error }),
        headers: { 'content-type': 'application/json' },
        status: outcome.status,
      })
    }

    return route.fulfill({
      body: JSON.stringify({ element: outcome }),
      headers: { 'content-type': 'application/json' },
      status: 200,
    })
  })
}

/**
 * Open the manage assistant widget from the top-level frontend-manage page
 * and return a FrameLocator scoped to its embedded iframe (apps/chat `/manage`).
 */
export async function openManageAssistantWidget(page: Page) {
  await page.getByTestId('manage-assistant-open').click()
  await page
    .getByTestId('manage-assistant-drawer')
    .waitFor({ state: 'visible' })

  const assistantFrame = page.frameLocator('[data-cy="manage-assistant-frame"]')
  // The composer only renders once the iframe has hydrated and the manage
  // context handshake has completed, so waiting for it is a reliable
  // "assistant ready" signal.
  await assistantFrame
    .getByTestId('chat-composer')
    .waitFor({ state: 'visible' })

  return assistantFrame
}

/** Type a message into the manage assistant composer and send it */
export async function sendManageAssistantMessage(
  assistant: FrameLocator,
  text: string
) {
  // The assistant-ui composer is a controlled textarea whose value flows
  // through the runtime. Inside the embedded iframe, neither pressSequentially()
  // nor fill() reaches the runtime state, so the send button stays disabled.
  // Setting the value through the native textarea setter and firing a
  // React-visible input event updates the runtime and enables send — but the
  // runtime is not always ready on the very first interaction, so re-apply the
  // value until the send button actually enables.
  const input = assistant.getByTestId('chat-composer-input')
  const send = assistant.getByTestId('chat-send-button')
  await input.click()
  await expect(async () => {
    await input.evaluate((el, value) => {
      const textarea = el as HTMLTextAreaElement
      const setValue = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set
      setValue?.call(textarea, value)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }, text)
    await expect(send).toBeEnabled({ timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
  await send.click()
}

/**
 * Register a listener on the top-level page (before navigation) that records
 * every `window.postMessage` the manage page receives, so tests can assert
 * the `klicker:manage-element-created` message crossed the iframe boundary
 * (see apps/frontend-manage/src/components/assistant/manageElementCreatedMessage.ts).
 */
export async function collectWindowMessages(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __e2eWindowMessages: unknown[] }
    w.__e2eWindowMessages = []
    window.addEventListener('message', (event) => {
      w.__e2eWindowMessages.push({ data: event.data, origin: event.origin })
    })
  })
}

export async function getWindowMessages(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __e2eWindowMessages: unknown[] })
        .__e2eWindowMessages ?? []
  )
}
