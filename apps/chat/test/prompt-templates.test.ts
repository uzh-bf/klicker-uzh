import { describe, expect, test } from 'vitest'
import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

describe('repository prompt templates', () => {
  test('rejects a missing interpolation value instead of silently dropping it', () => {
    // Exercise the runtime boundary, where a template edit can add a variable
    // that its typed caller does not yet supply.
    expect(() =>
      // @ts-expect-error deliberately omitted required context
      renderPromptTemplate('course-data', {})
    ).toThrow()
  })

  test('preserves raw input without recursively evaluating template syntax', () => {
    const data = JSON.stringify({
      value: '<tag> & "quotes" \\math\n{{missing}} {{#if value}}literal{{/if}}',
    })
    const rendered = renderPromptTemplate('course-data', { courseData: data })
    expect(rendered.endsWith(data)).toBe(true)
    expect(JSON.parse(rendered.slice(rendered.lastIndexOf('\n') + 1))).toEqual(
      JSON.parse(data)
    )
  })

  test('isolates values between renders of a cached template', () => {
    const first = renderPromptTemplate('lecturer-guidance', {
      lecturerPrompt: 'SYNTHETIC-A',
    })
    const second = renderPromptTemplate('lecturer-guidance', {
      lecturerPrompt: 'SYNTHETIC-B',
    })
    expect(first.endsWith('SYNTHETIC-A')).toBe(true)
    expect(second.endsWith('SYNTHETIC-B')).toBe(true)
    expect(second).not.toContain('SYNTHETIC-A')
  })

  test('includes optional image context once and preserves its literal value', () => {
    const value = '{{missing}}\n<synthetic> & \\math'
    const empty = renderPromptTemplate('image-description', { userContent: '' })
    const contextual = renderPromptTemplate('image-description', {
      userContent: value,
    })
    expect(contextual.endsWith(empty)).toBe(true)
    expect(contextual.split(value)).toHaveLength(2)
    expect(empty).not.toContain(value)
  })
})
