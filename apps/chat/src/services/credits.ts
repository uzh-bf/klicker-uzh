import { prisma } from '@klicker-uzh/prisma'

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
    const initialAmount = finalSettings.initialCredits

    const credits = await prisma.chatUsageCredits.create({
      data: {
        participantId,
        chatbotId,
        total: initialAmount,
        current: initialAmount,
        periodStartedAt: new Date(),
        lastResetAt: new Date(),
        resetCount: 0,
      },
    })

    return {
      current: credits.current.toNumber(),
      total: credits.total.toNumber(),
    }
  }

  /**
   * Checks if credits should be reset based on the last reset time and reset period
   */
  static shouldResetCredits(
    lastResetAt: Date,
    resetPeriod: ResetPeriod
  ): boolean {
    const now = new Date()
    const timeDiff = now.getTime() - lastResetAt.getTime()

    switch (resetPeriod) {
      case ResetPeriod.DAILY:
        return timeDiff >= 24 * 60 * 60 * 1000 // 24 hours
      case ResetPeriod.WEEKLY:
        return timeDiff >= 7 * 24 * 60 * 60 * 1000 // 7 days
      case ResetPeriod.BIWEEKLY:
        return timeDiff >= 14 * 24 * 60 * 60 * 1000 // 14 days
      case ResetPeriod.MONTHLY:
        // Reset on same day of month (e.g., every 1st of month)
        const lastResetMonth = lastResetAt.getMonth()
        const currentMonth = now.getMonth()
        return (
          lastResetMonth !== currentMonth ||
          now.getFullYear() > lastResetAt.getFullYear()
        )
      case ResetPeriod.NONE:
      default:
        return false
    }
  }

  /**
   * Checks and applies credit reset if needed
   */
  static async checkAndResetCredits(
    existingCredits: any, // ChatUsageCredits type
    chatbotId: string
  ): Promise<UserCredits> {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { creditSettings: true },
    })

    const settings = chatbot?.creditSettings as CreditSettings | null
    if (!settings || settings.resetPeriod === 'none') {
      return {
        current: existingCredits.current.toNumber(),
        total: existingCredits.total.toNumber(),
      }
    }

    const shouldReset = this.shouldResetCredits(
      existingCredits.lastResetAt || existingCredits.createdAt,
      settings.resetPeriod as ResetPeriod
    )

    if (shouldReset) {
      const updatedCredits = await prisma.chatUsageCredits.update({
        where: {
          participantId_chatbotId: {
            participantId: existingCredits.participantId,
            chatbotId: existingCredits.chatbotId,
          },
        },
        data: {
          current: Math.min(
            existingCredits.current.toNumber() + settings.resetAmount,
            settings.maxCredits
          ),
          total: settings.maxCredits,
          lastResetAt: new Date(),
          resetCount: existingCredits.resetCount + 1,
        },
      })

      return {
        current: updatedCredits.current.toNumber(),
        total: updatedCredits.total.toNumber(),
      }
    }

    return {
      current: existingCredits.current.toNumber(),
      total: existingCredits.total.toNumber(),
    }
  }

  /**
   * Gets user credits for a specific chatbot, creating default credits if none exist
   */
  static async getUserCredits(
    participantId: string,
    chatbotId: string
  ): Promise<UserCredits> {
    let credits = await prisma.chatUsageCredits.findUnique({
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

    // Check if reset is needed and apply it
    return await this.checkAndResetCredits(credits, chatbotId)
  }

  /**
   * Updates user credits
   */
  static async updateCredits(
    participantId: string,
    chatbotId: string,
    newCurrent: number
  ): Promise<UserCredits> {
    const credits = await prisma.chatUsageCredits.update({
      where: {
        participantId_chatbotId: {
          participantId,
          chatbotId,
        },
      },
      data: {
        current: Math.max(0.0, newCurrent).toFixed(6),
      },
    })

    return {
      current: credits.current.toNumber(),
      total: credits.total.toNumber(),
    }
  }

  /**
   * Decrements user credits by a specific amount
   */
  static async decrementCredits(
    participantId: string,
    chatbotId: string,
    amount: number
  ): Promise<UserCredits> {
    const currentCredits = await this.getUserCredits(participantId, chatbotId)
    const newCurrent = Math.max(0.0, currentCredits.current - amount)

    return await this.updateCredits(participantId, chatbotId, newCurrent)
  }
}
