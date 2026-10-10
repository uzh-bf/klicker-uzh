import type { Prisma } from '@klicker-uzh/prisma/client'
import {
  atomicDecrementCredits,
  atomicGetUserCredits,
  atomicInitializeCredits,
  atomicPreviewUserCredits,
  decrementCreditsWithPolicyInTransaction,
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
    return await atomicInitializeCredits(participantId, chatbotId)
  }

  /**
   * Gets user credits for a specific chatbot with automatic reset checking
   * Uses fixed period calculations and atomic operations
   */
  static async getUserCredits(
    participantId: string,
    chatbotId: string
  ): Promise<UserCredits> {
    return await atomicGetUserCredits(participantId, chatbotId)
  }

  /**
   * Reads effective credits without initializing or resetting participant state
   * so callers can authorize external work without a credit side effect.
   */
  static async previewUserCredits(
    participantId: string,
    chatbotId: string
  ): Promise<UserCredits> {
    return await atomicPreviewUserCredits(participantId, chatbotId)
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
    return await atomicDecrementCredits(participantId, chatbotId, amount)
  }

  /**
   * Decrements participant credits within a caller-owned transaction.
   *
   * Chat finalization uses this boundary so the participant debit, persisted
   * assistant answer, and owner usage charge either all commit or all roll
   * back together.
   */
  static async decrementCreditsInTransaction(
    tx: Prisma.TransactionClient,
    participantId: string,
    chatbotId: string,
    amount: number
  ): Promise<UserCredits> {
    return decrementCreditsWithPolicyInTransaction(
      tx,
      participantId,
      chatbotId,
      amount
    )
  }
}
