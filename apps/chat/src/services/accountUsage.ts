import {
  CHAT_MODEL_UNAVAILABLE_ADVANCED,
  CHAT_MODEL_UNAVAILABLE_BASE,
} from '@klicker-uzh/chat-api/host/services/accountUsage'
import type { ChatUsageClass } from '@klicker-uzh/prisma/client'
import { NextResponse } from 'next/server'

export * from '@klicker-uzh/chat-api/host/services/accountUsage'

export function chatModelUnavailableResponse(usageClass: ChatUsageClass) {
  return NextResponse.json(
    {
      error: 'Chat model usage is unavailable',
      code:
        usageClass === 'BASE'
          ? CHAT_MODEL_UNAVAILABLE_BASE
          : CHAT_MODEL_UNAVAILABLE_ADVANCED,
    },
    { status: 403 }
  )
}
