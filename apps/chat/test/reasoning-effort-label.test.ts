import { describe, expect, test } from 'vitest'
import { formatReasoningEffort } from '../src/lib/config/reasoning'

// Stands in for next-intl's `t`, using the same shape the real English
// messages produce for the `chat.settingsPanel.reasoningEfforts.*` keys.
const LABELS: Record<string, string> = {
  none: 'None',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
}

const t = ((key: string) =>
  LABELS[key.replace('chat.settingsPanel.reasoningEfforts.', '')] ??
  key) as unknown as Parameters<typeof formatReasoningEffort>[0]

describe('formatReasoningEffort', () => {
  test('returns the localized label for every well-known effort', () => {
    expect(formatReasoningEffort(t, 'none')).toBe('None')
    expect(formatReasoningEffort(t, 'minimal')).toBe('Minimal')
    expect(formatReasoningEffort(t, 'low')).toBe('Low')
    expect(formatReasoningEffort(t, 'medium')).toBe('Medium')
    expect(formatReasoningEffort(t, 'high')).toBe('High')
    expect(formatReasoningEffort(t, 'xhigh')).toBe('Extra high')
  })

  test('falls back to the capitalized raw name for an unknown effort', () => {
    expect(formatReasoningEffort(t, 'ultra')).toBe('Ultra')
  })

  test('does not treat inherited object keys as known efforts', () => {
    expect(formatReasoningEffort(t, 'toString')).toBe('ToString')
  })
})
