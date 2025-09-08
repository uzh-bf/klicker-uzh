import { prisma } from '@klicker-uzh/prisma'
import type { ChatThread } from '@klicker-uzh/prisma/client'

export interface Thread {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Service class for thread-related operations
 */
export class ThreadService {
  /**
   * Map Prisma thread object to API response format
   */
  private static mapThreadToResponse(thread: ChatThread): Thread {
    return {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    }
  }

  /**
   * Creates new thread with optional title
   */
  static async createThread(title?: string | null): Promise<Thread> {
    const thread = await prisma.chatThread.create({
      data: { title },
    })

    return this.mapThreadToResponse(thread)
  }

  /**
   * Retrieves all threads ordered by most recently updated
   */
  static async getAllThreads(): Promise<Thread[]> {
    const threads = await prisma.chatThread.findMany({
      orderBy: { updatedAt: 'desc' },
    })

    return threads.map((thread) => this.mapThreadToResponse(thread))
  }

  /**
   * Retrieves a specific thread by ID
   */
  static async getThreadById(threadId: string): Promise<Thread | null> {
    const thread = await prisma.chatThread.findUnique({
      where: { id: threadId },
    })

    if (!thread) return null
    return this.mapThreadToResponse(thread)
  }

  /**
   * Updates thread title
   */
  static async updateThreadTitle(
    threadId: string,
    title: string
  ): Promise<Thread> {
    const thread = await prisma.chatThread.update({
      where: { id: threadId },
      data: { title },
    })

    return this.mapThreadToResponse(thread)
  }

  /**
   * Deletes a thread and all its associated messages
   */
  static async deleteThread(threadId: string): Promise<void> {
    // delete messages first
    await prisma.chatMessage.deleteMany({
      where: { threadId },
    })

    // then delete thread
    await prisma.chatThread.delete({
      where: { id: threadId },
    })
  }

  /**
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
