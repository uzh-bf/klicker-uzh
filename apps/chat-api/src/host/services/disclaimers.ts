import { prisma } from '@klicker-uzh/prisma'
import { CreditsService } from './credits.js'

export class DisclaimersService {
  /**
   * Get disclaimer for a specific chatbot
   */
  static async getDisclaimerForChatbot(chatbotId: string) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        disclaimer: true,
      },
    })

    return chatbot?.disclaimer || null
  }

  /**
   * Check disclaimer acceptance status for a participant and chatbot
   */
  static async checkDisclaimerStatus(chatbotId: string, participantId: string) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { disclaimerId: true },
    })

    if (!chatbot?.disclaimerId) {
      return { required: false, accepted: true, declined: false }
    }

    const usageCredits = await prisma.chatUsageCredits.findUnique({
      where: {
        participantId_chatbotId: {
          participantId,
          chatbotId,
        },
      },
      select: {
        acceptedDisclaimerId: true,
        disclaimerAcceptedAt: true,
        disclaimerDeclined: true,
      },
    })

    const isAccepted =
      usageCredits?.acceptedDisclaimerId === chatbot.disclaimerId &&
      !usageCredits?.disclaimerDeclined

    return {
      required: true,
      accepted: isAccepted,
      disclaimerId: chatbot.disclaimerId,
      acceptedAt: usageCredits?.disclaimerAcceptedAt,
      declined: usageCredits?.disclaimerDeclined ?? false,
    }
  }

  /**
   * Accept disclaimer for a participant and chatbot
   */
  static async acceptDisclaimer(
    chatbotId: string,
    participantId: string,
    disclaimerId: string
  ) {
    // Ensure credits exist before updating disclaimer status so we don't
    // leave users with zero-total credits after a decline-only record was
    // created.
    await CreditsService.initializeCredits(participantId, chatbotId)

    await prisma.chatUsageCredits.upsert({
      where: {
        participantId_chatbotId: {
          participantId,
          chatbotId,
        },
      },
      create: {
        participantId,
        chatbotId,
        acceptedDisclaimerId: disclaimerId,
        disclaimerAcceptedAt: new Date(),
        disclaimerDeclined: false,
      },
      update: {
        acceptedDisclaimerId: disclaimerId,
        disclaimerAcceptedAt: new Date(),
        disclaimerDeclined: false,
      },
    })

    return { success: true }
  }

  /**
   * Decline disclaimer for a participant and chatbot
   */
  static async declineDisclaimer(chatbotId: string, participantId: string) {
    // Initialize credits so the record exists with proper totals even if the
    // user declines on their first visit. This prevents zero/zero totals on
    // later acceptance.
    await CreditsService.initializeCredits(participantId, chatbotId)

    await prisma.chatUsageCredits.upsert({
      where: {
        participantId_chatbotId: {
          participantId,
          chatbotId,
        },
      },
      create: {
        participantId,
        chatbotId,
        disclaimerDeclined: true,
      },
      update: {
        disclaimerDeclined: true,
        acceptedDisclaimerId: null,
        disclaimerAcceptedAt: null,
      },
    })

    return { success: true }
  }
}
