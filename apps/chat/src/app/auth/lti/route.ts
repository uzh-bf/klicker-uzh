import { prisma } from '@klicker-uzh/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  findOrCreateGuestPersona,
  signChatGuestToken,
  verifyLtiToken,
} from '../../../lib/server/ltiGuest'

const LTI_AUTH_LOG_PREFIX = '[chat:lti-auth]'

/**
 * LTI entry route for the chat app.
 *
 * Flow:
 * 1. Reads `jwt` query parameter (short-lived LTI token from apps/lti)
 * 2. Verifies the LTI JWT (signed with APP_SECRET, 5min expiry)
 * 3. Validates `courseId` and `chatbotId` query parameters
 * 4. Checks if an existing Klicker participant account exists for this LTI sub
 *    - If yes and user already has participant_token: redirect to chatbot (account mode)
 *    - If no: create anonymous guest persona and issue chat_participant_token
 * 5. Redirects to the chatbot page
 *
 * Query parameters:
 * - jwt: Required. The short-lived LTI JWT
 * - courseId: Required. The course context from LTI
 * - chatbotId: Required. The target chatbot
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  // -----------------------------------------------------------------------
  // 1. Parse and validate query params
  // -----------------------------------------------------------------------
  const querySchema = z.object({
    jwt: z.string().min(1),
    courseId: z.string().uuid(),
    chatbotId: z.string().uuid(),
  })

  const queryResult = querySchema.safeParse({
    jwt: searchParams.get('jwt'),
    courseId: searchParams.get('courseId'),
    chatbotId: searchParams.get('chatbotId'),
  })

  if (!queryResult.success) {
    console.error(LTI_AUTH_LOG_PREFIX, 'Invalid query params:', {
      errors: queryResult.error.flatten(),
    })
    return NextResponse.json(
      {
        error: 'Missing or invalid query parameters (jwt, courseId, chatbotId)',
      },
      { status: 400 }
    )
  }

  const { jwt, courseId, chatbotId } = queryResult.data

  // -----------------------------------------------------------------------
  // 2. Verify LTI JWT
  // -----------------------------------------------------------------------
  let ltiPayload
  try {
    ltiPayload = await verifyLtiToken(jwt)
  } catch (error) {
    console.error(LTI_AUTH_LOG_PREFIX, 'LTI JWT verification failed:', error)
    return NextResponse.json(
      { error: 'Invalid or expired LTI token' },
      { status: 401 }
    )
  }

  console.info(LTI_AUTH_LOG_PREFIX, 'LTI token verified', {
    ltiSub: ltiPayload.sub,
    ltiScope: ltiPayload.scope,
    courseId,
    chatbotId,
  })

  // -----------------------------------------------------------------------
  // 3. Validate course and chatbot exist
  // -----------------------------------------------------------------------
  const [course, chatbot] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    }),
    prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { id: true, courseId: true },
    }),
  ])

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  // -----------------------------------------------------------------------
  // 4. Check if LTI user has an existing Klicker participant account
  // -----------------------------------------------------------------------
  const existingAccount = await prisma.participantAccount.findUnique({
    where: { ssoId: ltiPayload.sub },
    select: { participantId: true, type: true },
  })

  // If user has a real (non-guest) account and already has participant_token,
  // redirect them directly to the chatbot in account mode (ensure participation)
  if (existingAccount && existingAccount.type !== 'lti_guest') {
    // Ensure participation exists for the course
    await prisma.participation.upsert({
      where: {
        courseId_participantId: {
          courseId,
          participantId: existingAccount.participantId,
        },
      },
      create: {
        course: { connect: { id: courseId } },
        participant: { connect: { id: existingAccount.participantId } },
      },
      update: {},
    })

    console.info(LTI_AUTH_LOG_PREFIX, 'Existing account found, redirecting', {
      participantId: existingAccount.participantId,
      chatbotId,
    })

    // Redirect to chatbot - the existing participant_token (if present) will
    // be used. If not, they'll hit the middleware and be redirected to login.
    const chatbotUrl = req.nextUrl.clone()
    chatbotUrl.pathname = `/${chatbotId}`
    chatbotUrl.search = ''
    return NextResponse.redirect(chatbotUrl)
  }

  // -----------------------------------------------------------------------
  // 5. Create or find anonymous guest persona
  // -----------------------------------------------------------------------
  let guestResult
  try {
    guestResult = await findOrCreateGuestPersona(
      ltiPayload.sub,
      ltiPayload.scope,
      courseId
    )
  } catch (error) {
    console.error(LTI_AUTH_LOG_PREFIX, 'Failed to create guest persona:', error)
    return NextResponse.json(
      { error: 'Failed to create guest session' },
      { status: 500 }
    )
  }

  console.info(LTI_AUTH_LOG_PREFIX, 'Guest persona ready', {
    participantId: guestResult.participantId,
    isNew: guestResult.isNew,
    chatbotId,
  })

  // -----------------------------------------------------------------------
  // 6. Issue chat_participant_token and redirect
  // -----------------------------------------------------------------------
  let chatGuestToken
  try {
    chatGuestToken = await signChatGuestToken(guestResult.participantId)
  } catch (error) {
    console.error(
      LTI_AUTH_LOG_PREFIX,
      'Failed to sign chat guest token:',
      error
    )
    return NextResponse.json(
      { error: 'Failed to create guest session' },
      { status: 500 }
    )
  }

  const chatbotUrl = req.nextUrl.clone()
  chatbotUrl.pathname = `/${chatbotId}`
  chatbotUrl.search = ''

  const response = NextResponse.redirect(chatbotUrl)

  // Set the chat_participant_token as a host-only cookie for the chat subdomain
  const isProduction =
    process.env.NODE_ENV === 'production' &&
    process.env.COOKIE_DOMAIN !== '127.0.0.1'

  response.cookies.set('chat_participant_token', chatGuestToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14, // 14 days
    // Do NOT set domain — host-only cookie ensures it never leaves the chat subdomain
  })

  return response
}
