import { prisma } from '@klicker-uzh/prisma'
import { CreditResetPeriod } from '@klicker-uzh/prisma/client'
import { getCurrentPeriodStart, isPeriodExpired } from '../utils/creditPeriods'
import {
  atomicDecrementCredits,
  atomicInitializeCredits,
  atomicResetCreditsIfNeeded,
} from '../utils/transactions'

export interface UserCredits {
  current: number
  total: number
}

/**
 * Service class for credits-related ops
 */
export class CreditsService {
  /**
   * Initializes credits for a new user based on chatbot configuration
   * Uses fixed period alignment and atomic operations
   */
  static async initializeCredits(
    participantId: string,
    chatbotId: string
  ): Promise<UserCredits> {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: {
        creditInitialCredits: true,
        creditResetPeriod: true,
        creditResetAmount: true,
        creditMaxCredits: true,
      },
    })

    const initialCredits = chatbot?.creditInitialCredits ?? 1
    const maxCredits = chatbot?.creditMaxCredits ?? 1
    const resetPeriod = chatbot?.creditResetPeriod ?? CreditResetPeriod.WEEKLY

    // Get current period start for proper alignment
    const currentPeriodStart = getCurrentPeriodStart(resetPeriod)

    return await atomicInitializeCredits(
      participantId,
      chatbotId,
      initialCredits,
      maxCredits,
      currentPeriodStart
    )
  }

  /**
   * Gets user credits for a specific chatbot with automatic reset checking
   * Uses fixed period calculations and atomic operations
   */
  static async getUserCredits(
    participantId: string,
    chatbotId: string
  ): Promise<UserCredits> {
    const credits = await prisma.chatUsageCredits.findUnique({
      where: {
        participantId_chatbotId: {
          participantId,
          chatbotId,
        },
      },
    })

    // Initialize with chatbot's default settings if no credits exist
    if (!credits) {
      return await this.initializeCredits(participantId, chatbotId)
    }

    // Get chatbot settings for reset configuration
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: {
        creditResetPeriod: true,
        creditResetAmount: true,
        creditMaxCredits: true,
      },
    })

    if (!chatbot || chatbot.creditResetPeriod === CreditResetPeriod.NONE) {
      return {
        current: credits.current.toNumber(),
        total: credits.total.toNumber(),
      }
    }

    const resetPeriod = chatbot.creditResetPeriod
    const currentPeriodStart = getCurrentPeriodStart(resetPeriod)
    const periodStartedAt = credits.periodStartedAt || credits.createdAt

    // Check if reset is needed using fixed period calculation
    if (isPeriodExpired(periodStartedAt, resetPeriod)) {
      const result = await atomicResetCreditsIfNeeded(
        participantId,
        chatbotId,
        currentPeriodStart,
        chatbot.creditResetAmount,
        chatbot.creditMaxCredits
      )

      return {
        current: result.current,
        total: result.total,
      }
    }

    return {
      current: credits.current.toNumber(),
      total: credits.total.toNumber(),
    }
  }

  /**
   * Reads effective credits without initializing or resetting participant state
   * so callers can authorize external work without a credit side effect.
   */
  static async previewUserCredits(
    participantId: string,
    chatbotId: string
  ): Promise<UserCredits> {
    const credits = await prisma.chatUsageCredits.findUnique({
      where: {
        participantId_chatbotId: {
          participantId,
          chatbotId,
        },
      },
    })

    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: {
        creditInitialCredits: true,
        creditResetPeriod: true,
        creditResetAmount: true,
        creditMaxCredits: true,
      },
    })

    if (!credits) {
      return {
        current: chatbot?.creditInitialCredits ?? 1,
        total: chatbot?.creditMaxCredits ?? 1,
      }
    }

    if (!chatbot || chatbot.creditResetPeriod === CreditResetPeriod.NONE) {
      return {
        current: credits.current.toNumber(),
        total: credits.total.toNumber(),
      }
    }

    const periodStartedAt = credits.periodStartedAt || credits.createdAt
    if (isPeriodExpired(periodStartedAt, chatbot.creditResetPeriod)) {
      return {
        current: Math.min(
          credits.current.toNumber() + chatbot.creditResetAmount,
          chatbot.creditMaxCredits
        ),
        total: chatbot.creditMaxCredits,
      }
    }

    return {
      current: credits.current.toNumber(),
      total: credits.total.toNumber(),
    }
  }

  /**
   * Decrements user credits by a specific amount atomically
   * Prevents race conditions and ensures credits cannot go below zero
   */
  static async decrementCredits(
    participantId: string,
    chatbotId: string,
    amount: number
  ): Promise<UserCredits> {
    // First ensure credits exist and are up to date
    await this.getUserCredits(participantId, chatbotId)

    // Then atomically decrement
    return await atomicDecrementCredits(participantId, chatbotId, amount)
  }
}
