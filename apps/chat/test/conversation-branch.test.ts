import { describe, expect, test } from 'vitest'
import { getPathToLeaf } from '../src/lib/api/utils'
import { walkConversationBranch } from '../src/lib/conversationBranch'

type Message = {
  id: string
  parentId: string | null
  role: 'user' | 'assistant'
  content: string
}

function message(
  id: string,
  parentId: string | null,
  role: Message['role']
): Message {
  return { id, parentId, role, content: id }
}

describe('conversation branch walking', () => {
  test('returns only the selected root-to-leaf parent chain', () => {
    const messages = [
      message('root', null, 'user'),
      message('answer', 'root', 'assistant'),
      message('leaf', 'answer', 'user'),
      message('sibling', 'answer', 'user'),
    ]

    expect(walkConversationBranch(messages, 'leaf')).toEqual([
      messages[0],
      messages[1],
      messages[2],
    ])
    expect(getPathToLeaf(messages, 'leaf').map(({ id }) => id)).toEqual([
      'root',
      'answer',
      'leaf',
    ])
  })

  test('fails closed when an ancestor is absent', () => {
    expect(
      walkConversationBranch([message('leaf', 'missing', 'user')], 'leaf')
    ).toEqual([])
  })

  test('terminates a cycle without manufacturing a partial path', () => {
    const messages = [
      message('first', 'second', 'user'),
      message('second', 'first', 'assistant'),
    ]

    expect(walkConversationBranch(messages, 'first')).toEqual([])
    expect(getPathToLeaf(messages, 'first')).toEqual([])
  })
})
