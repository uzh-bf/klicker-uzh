import {
  ElementBlockStatus,
  ElementInstanceType,
  ElementType,
  PublicationStatus,
  UserLoginScope,
  UserRole,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { signJWT } from '@klicker-uzh/util'
import { TRPCError } from '@trpc/server'
import { toElementDataWithoutSolutions } from './participantPracticeQuizzes.js'

type CookieResponse = {
  clearCookie?(name: string, options: Record<string, unknown>): unknown
  cookie(name: string, value: string, options: Record<string, unknown>): unknown
}

type RequestWithCookies = {
  cookies?: Record<string, string | undefined>
}

type LiveQuizSessionUser = {
  role?: UserRole
  scope?: UserLoginScope
  sub?: string
} | null

type LiveQuizElement = {
  elementData: unknown
  elementType: ElementType
  id: number
  type: ElementInstanceType
}

type LiveQuizBlock = {
  elements: LiveQuizElement[]
  execution: number
  expiresAt: Date | null
  id: number
  randomSelection: number | null
  startedAt?: Date | null
  status: ElementBlockStatus
  timeLimit: number | null
}

function getCookieResponse(res: unknown): CookieResponse {
  if (!res || typeof res !== 'object' || !('cookie' in res)) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Cookie response unavailable',
    })
  }

  return res as CookieResponse
}

function getCookieRequest(req: unknown): RequestWithCookies {
  return req && typeof req === 'object' ? (req as RequestWithCookies) : {}
}

function liveQuizPinInvalid(): never {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'LIVE_QUIZ_PIN_INVALID',
  })
}

function forbidden(message: string): never {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message,
  })
}

function clearLiveQuizPinCookie({
  cookieName,
  res,
}: {
  cookieName: string
  res: unknown
}) {
  try {
    const cookieResponse =
      res && typeof res === 'object' && 'clearCookie' in res
        ? (res as CookieResponse)
        : null
    cookieResponse?.clearCookie?.(cookieName, {
      domain: process.env.COOKIE_DOMAIN as string | undefined,
      path: '/',
      secure: false,
      sameSite: 'lax',
    })
  } catch (_) {}
}

function toLiveQuizElement(
  element: LiveQuizElement,
  correlationKey?: string | null
) {
  return {
    __typename: 'ElementInstance' as const,
    id: element.id,
    type: element.type,
    elementType: element.elementType,
    correlationKey,
    elementData: toElementDataWithoutSolutions(element.elementData),
  }
}

function toLiveQuizBlock(block: LiveQuizBlock, elements: LiveQuizElement[]) {
  return {
    __typename: 'ElementBlock' as const,
    id: block.id,
    status: block.status,
    expiresAt: block.expiresAt,
    timeLimit: block.timeLimit,
    randomSelection: block.randomSelection,
    execution: block.execution,
    elements: elements.map((element) => toLiveQuizElement(element)),
  }
}

export async function setLiveQuizPinCookie({
  liveQuizId,
  pin,
  prisma,
  res,
}: {
  liveQuizId: string
  pin: string
  prisma: PrismaClient
  res: unknown
}) {
  const liveQuiz = await prisma.liveQuiz.findUnique({
    where: { id: liveQuizId },
    select: { id: true, status: true, pinCode: true },
  })
  if (!liveQuiz || liveQuiz.status !== PublicationStatus.PUBLISHED) {
    liveQuizPinInvalid()
  }

  const cookieName = `live-quiz-pin-${liveQuizId}`
  const cookieResponse = getCookieResponse(res)
  if (!liveQuiz.pinCode || pin !== liveQuiz.pinCode) {
    try {
      cookieResponse.clearCookie?.(cookieName, {
        domain: process.env.COOKIE_DOMAIN as string | undefined,
        path: '/',
      })
    } catch (_) {}
    liveQuizPinInvalid()
  }

  cookieResponse.cookie(cookieName, pin, {
    domain: process.env.COOKIE_DOMAIN,
    path: '/',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    secure:
      process.env.NODE_ENV === 'production' &&
      process.env.COOKIE_DOMAIN !== '127.0.0.1',
    sameSite: 'lax',
  })

  return true
}

export async function getRunningLiveQuiz({
  id,
  prisma,
  req,
  res,
  user,
}: {
  id: string
  prisma: PrismaClient
  req?: unknown
  res?: unknown
  user?: LiveQuizSessionUser
}) {
  const quizInfo = await prisma.liveQuiz.findUnique({ where: { id } })

  if (!quizInfo || quizInfo.status !== PublicationStatus.PUBLISHED) {
    return { studentLiveQuiz: null }
  }

  if (quizInfo.isAssessmentEnabled) {
    if (
      !user?.sub ||
      user.role !== UserRole.PARTICIPANT ||
      user.scope !== UserLoginScope.EDUID
    ) {
      forbidden('UNAUTHORIZED_ASSESSMENT')
    }

    if (quizInfo.courseId) {
      const participation = await prisma.participation.findUnique({
        where: {
          courseId_participantId: {
            courseId: quizInfo.courseId,
            participantId: user.sub,
          },
        },
      })

      if (!participation) {
        forbidden('MISSING_ASSESSMENT_COURSE_PARTICIPATION')
      }
    }
  }

  if (quizInfo.pinCode) {
    const cookieName = `live-quiz-pin-${id}`
    const providedPin = getCookieRequest(req).cookies?.[cookieName]

    if (!providedPin) {
      forbidden(
        quizInfo.isAssessmentEnabled
          ? 'LIVE_QUIZ_PIN_MISSING_ASSESSMENT'
          : 'LIVE_QUIZ_PIN_MISSING'
      )
    }

    if (providedPin !== quizInfo.pinCode) {
      clearLiveQuizPinCookie({ cookieName, res })
      forbidden('LIVE_QUIZ_PIN_INVALID')
    }
  }

  const quiz = await prisma.liveQuiz.findUnique({
    where: { id },
    include: {
      activeBlock: {
        include: { elements: { orderBy: { order: 'asc' } } },
      },
      blocks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
      course: true,
    },
  })

  if (!quiz || quiz.status !== PublicationStatus.PUBLISHED) {
    return { studentLiveQuiz: null }
  }

  const beforeFirstBlock = quiz.blocks.every(
    (block) => block.status === ElementBlockStatus.SCHEDULED
  )

  const activeBlock = quiz.activeBlock
    ? {
        ...toLiveQuizBlock(quiz.activeBlock, []),
        elements: await Promise.all(
          quiz.activeBlock.elements.map(async (element) => {
            if (!quiz.isAssessmentEnabled) {
              return toLiveQuizElement(element)
            }

            const correlationKey = await signJWT(
              {
                instanceId: element.id,
                execution: quiz.activeBlock!.execution,
                liveQuizId: quiz.id,
                sub: '',
              },
              process.env.APP_SECRET as string,
              {
                issuer: process.env.APP_ORIGIN_ASSESSMENT_API,
                issuedAt: quiz.activeBlock?.startedAt ?? new Date(0),
              }
            )

            return toLiveQuizElement(element, correlationKey)
          })
        ),
      }
    : null

  return {
    studentLiveQuiz: {
      __typename: 'LiveQuiz' as const,
      id: quiz.id,
      status: quiz.status,
      isLiveQAEnabled: quiz.isLiveQAEnabled,
      isConfusionFeedbackEnabled: quiz.isConfusionFeedbackEnabled,
      isModerationEnabled: quiz.isModerationEnabled,
      isGamificationEnabled: quiz.isGamificationEnabled,
      isAssessmentEnabled: quiz.isAssessmentEnabled,
      isPartOfGamifiedCourse: !!quiz.course?.isGamificationEnabled,
      beforeFirstBlock,
      namespace: quiz.namespace,
      displayName: quiz.displayName,
      description: quiz.description,
      course: quiz.course
        ? {
            __typename: 'Course' as const,
            id: quiz.course.id,
            displayName: quiz.course.displayName,
            color: quiz.course.color,
          }
        : null,
      blocks: quiz.blocks.map((block) =>
        toLiveQuizBlock(
          block,
          block.status === ElementBlockStatus.EXECUTED ? block.elements : []
        )
      ),
      activeBlock,
    },
  }
}
