import { prisma } from '@klicker-uzh/prisma'
import type { ChatThread } from '@klicker-uzh/prisma/client'

export interface Thread {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
  lastChatMode: string | null
}

/**
 * Service class for thread-related operations
 */
export class ThreadService {
  /**
   * Map Prisma thread object to API response format.
   * `lastChatMode` is only authoritative from `getAllThreads` (which loads the
   * latest message's mode); other callers pass the default `null`.
   */
  private static mapThreadToResponse(
    thread: ChatThread,
    lastChatMode: string | null = null
  ): Thread {
    return {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      lastChatMode,
    }
  }

  /**
   * Creates new thread with optional title
   */
  static async createThread(
    participantId: string,
    chatbotId: string,
    title?: string | null
  ): Promise<Thread> {
    const thread = await prisma.chatThread.create({
      data: {
        title,
        participant: {
          connect: { id: participantId },
        },
        chatbot: {
          connect: { id: chatbotId },
        },
      },
    })

    return this.mapThreadToResponse(thread)
  }

  /**
   * Retrieves all threads for a specific participant and chatbot ordered by most recently updated
   */
  static async getAllThreads(
    participantId: string,
    chatbotId: string
  ): Promise<Thread[]> {
    const threads = await prisma.chatThread.findMany({
      where: {
        participantId,
        chatbotId,
      },
      orderBy: { updatedAt: 'desc' },
      // Pull only the most recent message's mode so the sidebar can badge each
      // thread with the mode it was last used in (D6).
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { chatMode: true },
        },
      },
    })

    return threads.map((thread) =>
      this.mapThreadToResponse(thread, thread.messages[0]?.chatMode ?? null)
    )
  }

  /**
   * Retrieves a specific thread by ID if it belongs to the participant and chatbot
   */
  static async getThreadById(
    threadId: string,
    participantId: string,
    chatbotId: string
  ): Promise<Thread | null> {
    const thread = await prisma.chatThread.findFirst({
      where: {
        id: threadId,
        participantId,
        chatbotId,
      },
    })

    if (!thread) return null
    return this.mapThreadToResponse(thread)
  }

  /**
   * Updates thread title if it belongs to the participant and chatbot
   */
  static async updateThreadTitle(
    threadId: string,
    participantId: string,
    chatbotId: string,
    title: string
  ): Promise<Thread | null> {
    // verify ownership
    const existingThread = await this.getThreadById(
      threadId,
      participantId,
      chatbotId
    )
    if (!existingThread) return null

    const thread = await prisma.chatThread.update({
      where: { id: threadId },
      data: { title },
    })

    return this.mapThreadToResponse(thread)
  }

  /**
   * Deletes a thread and all its associated messages if it belongs to the participant
   */
  static async deleteThread(
    threadId: string,
    participantId: string,
    chatbotId: string
  ): Promise<boolean> {
    // verify ownership
    const existingThread = await this.getThreadById(
      threadId,
      participantId,
      chatbotId
    )

    if (!existingThread) return false

    // delete messages first
    await prisma.chatMessage.deleteMany({
      where: { threadId },
    })

    // then delete thread
    await prisma.chatThread.delete({
      where: { id: threadId },
    })

    return true
  } /**
   * Updates thread's updatedAt timestamp
   */
  static async updateThreadTimestamp(threadId: string): Promise<Thread> {
    const thread = await prisma.chatThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    })

    return this.mapThreadToResponse(thread)
  }
}
