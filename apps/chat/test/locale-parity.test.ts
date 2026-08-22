import de from '@klicker-uzh/i18n/messages/de'
import en from '@klicker-uzh/i18n/messages/en'
import { describe, expect, test } from 'vitest'

type MessageTree = { [key: string]: string | MessageTree }

// Pre-existing single-locale keys, all outside the chat namespace. Listed
// explicitly so any *new* divergence still fails this test.
const KNOWN_DE_ONLY_KEYS = [
  'pwa.groupActivity.failed',
  'pwa.groupActivity.passed',
]
const KNOWN_EN_ONLY_KEYS = [
  'manage.catalog.removeObject',
  'manage.catalog.removeObjectTitle',
  'pwa.profile.privacyDataCollection',
  'pwa.profile.privacyDataSharing',
  'pwa.profile.privacyDataStorage',
  'pwa.profile.privacyDataUsage',
]

function collectKeys(tree: MessageTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [path] : collectKeys(value, path)
  })
}

function collectLeaves(tree: MessageTree, prefix = ''): Map<string, string> {
  const leaves = new Map<string, string>()
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      leaves.set(path, value)
    } else {
      for (const [nestedPath, nested] of collectLeaves(value, path)) {
        leaves.set(nestedPath, nested)
      }
    }
  }
  return leaves
}

// ICU arguments only. An argument name is always followed by `}` or `,`, so
// literal plural branch text (`one {Show # more}`) is not mistaken for one.
function collectPlaceholders(message: string): string[] {
  return Array.from(message.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*[,}]/g))
    .map((match) => match[1]!)
    .sort()
}

const enMessages = en as unknown as MessageTree
const deMessages = de as unknown as MessageTree

describe('locale catalog parity', () => {
  test('en and de expose the same key tree', () => {
    const enKeys = collectKeys(enMessages).sort()
    const deKeys = collectKeys(deMessages).sort()

    expect(
      deKeys.filter(
        (key) => !enKeys.includes(key) && !KNOWN_DE_ONLY_KEYS.includes(key)
      )
    ).toEqual([])
    expect(
      enKeys.filter(
        (key) => !deKeys.includes(key) && !KNOWN_EN_ONLY_KEYS.includes(key)
      )
    ).toEqual([])
  })

  test('chat messages use the same ICU placeholders in both locales', () => {
    // Scoped to the chat namespace: `manage.*` carries pre-existing placeholder
    // divergences (e.g. a de translation dropping `{number}`) that this app
    // does not own.
    const enLeaves = collectLeaves(enMessages.chat as MessageTree, 'chat')
    const deLeaves = collectLeaves(deMessages.chat as MessageTree, 'chat')

    const mismatches: string[] = []
    for (const [path, enMessage] of enLeaves) {
      const deMessage = deLeaves.get(path)
      if (deMessage === undefined) continue

      const enPlaceholders = collectPlaceholders(enMessage)
      const dePlaceholders = collectPlaceholders(deMessage)
      if (enPlaceholders.join(',') !== dePlaceholders.join(',')) {
        mismatches.push(
          `${path}: en=[${enPlaceholders.join(',')}] de=[${dePlaceholders.join(',')}]`
        )
      }
    }

    expect(mismatches).toEqual([])
  })
})
