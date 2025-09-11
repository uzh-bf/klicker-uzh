import { prisma } from '@klicker-uzh/prisma'

export interface UserCredits {
  current: number
  total: number
}

/**
 * Service class for credits-related ops
 */
export class CreditsService {
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

    // set credits to 0 if none exist
    if (!credits) {
      credits = await prisma.chatUsageCredits.create({
        data: {
          participantId,
          chatbotId,
          total: 0,
          current: 0,
        },
      })
    }

    return {
      current: credits.current,
      total: credits.total,
    }
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
        current: Math.max(0, newCurrent),
      },
    })

    return {
      current: credits.current,
      total: credits.total,
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
    const newCurrent = Math.max(0, currentCredits.current - amount)

    return await this.updateCredits(participantId, chatbotId, newCurrent)
  }
}
