import type { ExtendedThreadMessageLike } from '../../stores/chatStore'
import { walkConversationBranch } from '../conversationBranch'

/**
 * Builds path from leaf message to the root of the conversation tree
 * Used to reconstruct a specific conversation branch from all messages
 *
 * @param messages - All messages in the thread
 * @param leafId - The ID of the leaf message to trace back from
 * @returns Array of messages from root to leaf in chronological order
 */
export const getPathToLeaf = (
  messages: ExtendedThreadMessageLike[],
  leafId: string
): ExtendedThreadMessageLike[] => walkConversationBranch(messages, leafId)

/**
 * Finds all sibling messages for a given message
 * Siblings are messages with the same parent and role but different content
 *
 * @param messages - All messages in the thread
 * @param messageId - The ID of the message to find siblings for
 * @returns Array of all sibling messages (including original) sorted by creation time
 */
export const getBranches = (
  messages: ExtendedThreadMessageLike[],
  messageId: string
): ExtendedThreadMessageLike[] => {
  const message = messages.find((m) => m.id === messageId)
  if (!message) {
    return []
  }

  // find all siblings of given message
  const siblings = messages.filter(
    (m) =>
      m.parentId === message.parentId &&
      m.role === message.role &&
      m.id !== message.id
  )

  // return all messages (current + siblings) sorted by creation time
  const allMessages = [message, ...siblings].sort(
    (a, b) =>
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
  )

  return allMessages
}

/**
 * Finds all leaf messages in conversation tree
 *
 * @param messages - All messages in the thread
 * @returns Array of leaf messages
 */
export const findLeafMessages = (
  messages: ExtendedThreadMessageLike[]
): ExtendedThreadMessageLike[] => {
  const parentIds = new Set<string>()
  messages.forEach((m) => {
    if (m.parentId) parentIds.add(m.parentId)
  })

  // get all messages that are not parents
  return messages.filter(
    (m) => typeof m.id === 'string' && !parentIds.has(m.id)
  )
}

/**
 * Finds the actual leaf message in a branch starting from a given message
 * Traverses down the tree from the starting message to find the final leaf
 * When multiple children exist, picks the most recently created one
 *
 * @param messages - All messages in the thread
 * @param startMessageId - The ID of the message to start traversal from
 * @returns The leaf message at the end of this branch, or null if not found
 */
export const findBranchLeaf = (
  messages: ExtendedThreadMessageLike[],
  startMessageId: string
): ExtendedThreadMessageLike | null => {
  const messageMap = new Map(messages.map((m) => [m.id, m]))
  let current = messageMap.get(startMessageId)
  const visited = new Set<string>()

  if (!current) return null

  // build parent -> children mapping for efficient traversal
  const childrenMap: Map<string, ExtendedThreadMessageLike[]> = new Map()
  for (const m of messages) {
    if (m.parentId) {
      const arr = childrenMap.get(m.parentId) || []
      arr.push(m)
      childrenMap.set(m.parentId, arr)
    }
  }

  // traverse down the tree using children map
  while (current) {
    const id = typeof current.id === 'string' ? current.id : undefined
    if (!id || visited.has(id)) return null
    visited.add(id)
    const children: ExtendedThreadMessageLike[] = id
      ? childrenMap.get(id) || []
      : []

    if (children.length === 0) return current
    if (children.length === 1) {
      current = children[0]
      continue
    }

    let latest = children[0]
    for (let i = 1; i < children.length; i++) {
      const c = children[i]
      if (new Date(c.createdAt || 0) > new Date(latest.createdAt || 0)) {
        latest = c
      }
    }
    current = latest
  }

  return null
}

/**
 * Extracts first 50 characters from a message to use as a thread title
 *
 * @param message - The message to extract title from
 * @returns short title string, or null if no suitable content found
 */
export const extractThreadTitle = (
  message: ExtendedThreadMessageLike
): string | null => {
  const content = Array.isArray(message.content)
    ? message.content.find(
        (c: { type: string; text?: string }) => c.type === 'text'
      )?.text
    : message.content

  if (content && typeof content === 'string') {
    return content.slice(0, 50) + (content.length > 50 ? '...' : '')
  }

  return null
}
