import { prisma } from '@klicker-uzh/prisma'
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

export interface CreditSettings {
  initialCredits: number // Credits given to new users
  resetPeriod: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'none'
  resetAmount: number // Credits restored on reset
  maxCredits: number // Maximum credits (for partial resets)
}

export enum ResetPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  NONE = 'none',
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
      select: { creditSettings: true },
    })

    const settings = chatbot?.creditSettings as CreditSettings | null
    const defaultSettings: CreditSettings = {
      initialCredits: 10,
      resetPeriod: 'weekly',
      resetAmount: 10,
      maxCredits: 10,
    }

    const finalSettings = settings || defaultSettings
    const resetPeriod = finalSettings.resetPeriod as ResetPeriod

    // Get current period start for proper alignment
    const currentPeriodStart = getCurrentPeriodStart(resetPeriod)

    return await atomicInitializeCredits(
      participantId,
      chatbotId,
      finalSettings.initialCredits,
      finalSettings.maxCredits,
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
      select: { creditSettings: true },
    })

    const settings = chatbot?.creditSettings as CreditSettings | null
    if (!settings || settings.resetPeriod === 'none') {
      return {
        current: credits.current.toNumber(),
        total: credits.total.toNumber(),
      }
    }

    const resetPeriod = settings.resetPeriod as ResetPeriod
    const currentPeriodStart = getCurrentPeriodStart(resetPeriod)
    const periodStartedAt = credits.periodStartedAt || credits.createdAt

    // Check if reset is needed using fixed period calculation
    if (isPeriodExpired(periodStartedAt, resetPeriod)) {
      const result = await atomicResetCreditsIfNeeded(
        participantId,
        chatbotId,
        currentPeriodStart,
        settings.resetAmount,
        settings.maxCredits
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

  /**
   * Determines which model to use based on credit availability
   * Returns the primary model if credits are available, otherwise fallback model
   */
  static getAutomaticModel(credits: UserCredits): string {
    // Use primary model (GPT-4.1) when credits are available
    // Use fallback model (GPT-4.1-mini) when no credits
    return credits.current > 0 ? 'gpt-4.1' : 'gpt-4.1-mini'
  }
}
