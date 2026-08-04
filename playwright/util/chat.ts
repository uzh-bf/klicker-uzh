import { type Page } from '@playwright/test'
import * as jose from 'jose'
import { randomUUID } from 'node:crypto'
import { getPrisma } from '../global-setup.js'
import {
  APP_SECRET,
  COURSE_ID_TEST,
  PARTICIPANT_IDS,
  URL_CHAT,
  USER_ID_TEST,
} from './constants.js'

/**
 * Chat E2E helpers
 *
 * The Playwright global-setup seed creates the baseline users/courses/
 * participants but NOT a chatbot, so these helpers create the chatbot + its
 * disclaimer themselves (idempotently, against the Playwright-seeded course and
 * a real enrolled participant). They then set up per-test DB state (credits,
 * disclaimer acceptance, threads) via Prisma so the real chat API routes run.
 * Only the LLM endpoint (POST /chat) is mocked.
 */

export const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
export const DISCLAIMER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'

// participant enrolled in COURSE_ID_TEST by Playwright seed
export const PARTICIPANT_ID = PARTICIPANT_IDS[0]

export const chatUrl = () => process.env.URL_CHAT ?? URL_CHAT

function chatSecret() {
  return new TextEncoder().encode(process.env.APP_SECRET ?? APP_SECRET)
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------
export async function getEnrolledParticipantId(): Promise<string> {
  return PARTICIPANT_ID
}

export async function getDisclaimerId(): Promise<string> {
  return DISCLAIMER_ID
}

/**
 * Create chatbot + its disclaimer
 * Owned by the seeded lecturer and attached to the seeded test course
 */
export async function ensureChatbotSeeded() {
  const prisma = await getPrisma()
  await prisma.chatbotDisclaimer.upsert({
    where: { id: DISCLAIMER_ID },
    create: {
      id: DISCLAIMER_ID,
      name: 'E2E Disclaimer',
      title: 'Chatbot Terms of Use',
      introText: 'Welcome to the chatbot. Please read the following terms.',
      owner: { connect: { id: USER_ID_TEST } },
    },
    update: {},
  })
  await prisma.chatbot.upsert({
    where: { id: CHATBOT_ID },
    create: {
      id: CHATBOT_ID,
      name: 'E2E Chatbot',
      description: 'Chatbot used by the Playwright E2E suite.',
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_TEST,
      systemPrompts: {
        tutor: {
          prompt: 'You are a helpful tutor.',
          description: 'Tutor mode.',
        },
        explainer: {
          prompt: 'You are an expert explainer.',
          description: 'Explainer mode.',
        },
      },
      creditInitialCredits: 100,
      creditResetPeriod: 'WEEKLY',
      creditResetAmount: 50,
      creditMaxCredits: 100,
      modelSelection: true,
      disclaimerId: DISCLAIMER_ID,
    },
    update: { modelSelection: true, disclaimerId: DISCLAIMER_ID },
  })
}

/** Mint a participant_token (HS256/APP_SECRET, sub = participantId) */
export async function setParticipantToken(page: Page, participantId: string) {
  const token = await new jose.SignJWT({ sub: participantId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(chatSecret())

  const url = new URL(chatUrl())
  await page.context().addCookies([
    {
      name: 'participant_token',
      value: token,
      url: url.origin,
      httpOnly: true,
      sameSite: 'Lax',
      secure: url.protocol === 'https:',
    },
  ])
}

export async function clearChatCookies(page: Page) {
  await page.context().clearCookies()
}

// ---------------------------------------------------------------------------
// DB fixtures (per-test state for the real backend)
// ---------------------------------------------------------------------------

/**
 * Clean per-participant chat state and restore the seeded chatbot config
 */
export async function resetChatState(participantId: string) {
  await ensureChatbotSeeded()
  const prisma = await getPrisma()
  await prisma.chatThread.deleteMany({
    where: { participantId, chatbotId: CHATBOT_ID },
  })
  await prisma.chatUsageCredits.deleteMany({
    where: { participantId, chatbotId: CHATBOT_ID },
  })
  await prisma.chatbot.update({
    where: { id: CHATBOT_ID },
    data: { disclaimerId: DISCLAIMER_ID, modelSelection: true },
  })
}

/** Toggle whether chatbot requires a disclaimer */
export async function setDisclaimerRequired(required: boolean) {
  const prisma = await getPrisma()
  const disclaimerId = required ? await getDisclaimerId() : null
  await prisma.chatbot.update({
    where: { id: CHATBOT_ID },
    data: { disclaimerId },
  })
}

/** Set participant's disclaimer acceptance state for this chatbot */
export async function setDisclaimerState(
  participantId: string,
  state: 'pending' | 'accepted' | 'declined'
) {
  const prisma = await getPrisma()
  if (state === 'pending') {
    await prisma.chatUsageCredits.deleteMany({
      where: { participantId, chatbotId: CHATBOT_ID },
    })
    return
  }
  const disclaimerId = await getDisclaimerId()
  const fields =
    state === 'accepted'
      ? {
          acceptedDisclaimerId: disclaimerId,
          disclaimerAcceptedAt: new Date(),
          disclaimerDeclined: false,
        }
      : {
          acceptedDisclaimerId: null,
          disclaimerAcceptedAt: null,
          disclaimerDeclined: true,
        }
  await upsertCredits(participantId, fields)
}

/** Set explicit credit balances */
export async function setCredits(
  participantId: string,
  current: number,
  total: number
) {
  await upsertCredits(participantId, { current, total })
}

async function upsertCredits(
  participantId: string,
  fields: Record<string, unknown>
) {
  const prisma = await getPrisma()
  await prisma.chatUsageCredits.upsert({
    where: {
      participantId_chatbotId: { participantId, chatbotId: CHATBOT_ID },
    },
    create: {
      participantId,
      chatbotId: CHATBOT_ID,
      current: 50,
      total: 100,
      periodStartedAt: new Date(),
      ...fields,
    },
    update: { periodStartedAt: new Date(), ...fields },
  })
}

/** Whether participants may pick the AI model */
export async function setModelSelection(
  participantId: string,
  enabled: boolean
) {
  const prisma = await getPrisma()
  await prisma.chatbot.update({
    where: { id: CHATBOT_ID },
    data: { modelSelection: enabled },
  })
}

export type SeedAttachment = {
  imageBase64: string
  imagePreviewBase64?: string
  imageDescription?: string
}

export type SeedMessage = {
  id?: string
  role: 'user' | 'assistant'
  content: Array<
    | { type: 'text' | 'reasoning'; text: string }
    | {
        type: 'tool-call'
        toolCallId: string
        toolName: string
        args?: Record<string, unknown>
        result?: {
          content?: Array<{ type: string; text: string }>
          isError?: boolean
        }
      }
  >
  parentId?: string | null
  attachments?: SeedAttachment[]
  // Mode the message was sent/answered in ('tutor' | 'explainer' | ...). The
  // most recent message's chatMode becomes the thread's `lastChatMode` (D6).
  chatMode?: string | null
}

// 1x1 PNG as a test image
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
export const TEST_PNG_DATA_URL = `data:image/png;base64,${TEST_PNG_BASE64}`

/** file payload for page.setInputFiles / file_chooser */
export function testImageUpload(name = 'attachment.png') {
  return {
    name,
    mimeType: 'image/png',
    buffer: Buffer.from(TEST_PNG_BASE64, 'base64'),
  }
}

/**
 * Create a thread with optional messages
 */
export async function seedThread(
  participantId: string,
  {
    id,
    title,
    messages = [],
  }: { id?: string; title?: string | null; messages?: SeedMessage[] }
) {
  const prisma = await getPrisma()
  const thread = await prisma.chatThread.create({
    data: {
      ...(id ? { id } : {}),
      title: title ?? null,
      participantId,
      chatbotId: CHATBOT_ID,
    },
  })

  let previousId: string | null = null
  for (const m of messages) {
    const messageId = m.id ?? randomUUID()
    await prisma.chatMessage.create({
      data: {
        id: messageId,
        threadId: thread.id,
        role: m.role,
        content: m.content,
        parentId: m.parentId !== undefined ? m.parentId : previousId,
        chatMode: m.chatMode ?? null,
      },
    })
    if (m.attachments?.length) {
      await prisma.chatAttachment.createMany({
        data: m.attachments.map((a, ix) => ({
          messageId,
          type: 'IMAGE' as const,
          position: ix,
          imageBase64: a.imageBase64,
          imagePreviewBase64: a.imagePreviewBase64 ?? a.imageBase64,
          imageDescription: a.imageDescription ?? null,
        })),
      })
    }
    previousId = messageId
  }

  return thread
}

/** Persisted thumbs rating of a message, as the feedback route stored it. */
export async function getMessageRating(messageId: string) {
  const prisma = await getPrisma()
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { rating: true },
  })

  return message?.rating ?? null
}

// ---------------------------------------------------------------------------
// Mocked LLM endpoint
// ---------------------------------------------------------------------------
function makeStreamBody(text: string) {
  return [
    `data: ${JSON.stringify({ type: 'start' })}`,
    `data: ${JSON.stringify({ type: 'start-step' })}`,
    `data: ${JSON.stringify({ type: 'text-start' })}`,
    `data: ${JSON.stringify({ type: 'text-delta', delta: text })}`,
    `data: ${JSON.stringify({ type: 'text-end' })}`,
    `data: ${JSON.stringify({ type: 'finish-step' })}`,
    `data: ${JSON.stringify({ type: 'finish' })}`,
    'data: [DONE]',
  ].join('\n')
}

/**
 * Mock LLM endpoint (POST /chat)
 * Returns distinguishable streamed reply per call (`assistant reply #1`, `#2`, …)
 */
export async function mockChatStream(page: Page) {
  let counter = 0
  await page.route(`**/api/chatbots/${CHATBOT_ID}/chat`, (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    counter += 1
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: makeStreamBody(`assistant reply #${counter}`),
    })
  })
}
