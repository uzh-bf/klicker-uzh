import {
  DEFAULT_TUTOR_PROMPT,
  projectLegacySystemPrompts,
} from '@klicker-uzh/prisma'
import { describe, expect, test } from 'vitest'

describe('legacy chatbot prompt projection', () => {
  test.each([
    ['null root', null],
    ['empty object', {}],
    ['explicit null tutor prompt', { tutor: { prompt: null } }],
  ])('projects the tutor fallback for %s', (_label, systemPrompts) => {
    expect(projectLegacySystemPrompts(systemPrompts)).toEqual({
      isValid: true,
      modes: [
        {
          key: 'tutor',
          prompt: DEFAULT_TUTOR_PROMPT,
          description: null,
        },
      ],
    })
  })
})
