import { describe, expect, it } from 'vitest'
import {
  CHATBOT_CUSTOM_MODE_DESCRIPTION_MAX_LENGTH,
  CHATBOT_CUSTOM_MODE_NAME_MAX_LENGTH,
  CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH,
  normalizeChatbotCustomModeConfig,
  parseChatbotCustomModeConfigInput,
} from '../src/chatbotCustomModeConfig.js'

function parseModes(
  modes: Array<Record<string, unknown>>,
  existing: Parameters<typeof parseChatbotCustomModeConfigInput>[1] = null
) {
  return parseChatbotCustomModeConfigInput({ modes }, existing)
}

describe('chatbot custom mode configuration', () => {
  it('mints a server-side key and canonicalizes bounded fields', () => {
    const config = parseModes([
      {
        name: '  Interview coach  ',
        description: '  Practices interview questions  ',
        personaText: '  You are an interview coach.\r\nStay encouraging.  ',
      },
    ])

    expect(config.modes).toHaveLength(1)
    const [mode] = config.modes
    expect(mode.key).toMatch(/^cm_/)
    expect(mode.name).toBe('Interview coach')
    expect(mode.description).toBe('Practices interview questions')
    expect(mode.personaText).toBe(
      'You are an interview coach.\nStay encouraging.'
    )
  })

  it('rejects over-long names, descriptions, and persona text', () => {
    expect(() =>
      parseModes([
        { name: 'x'.repeat(CHATBOT_CUSTOM_MODE_NAME_MAX_LENGTH + 1) },
      ])
    ).toThrow(`name must be at most ${CHATBOT_CUSTOM_MODE_NAME_MAX_LENGTH}`)
    expect(() =>
      parseModes([
        {
          name: 'Mode',
          description: 'x'.repeat(
            CHATBOT_CUSTOM_MODE_DESCRIPTION_MAX_LENGTH + 1
          ),
        },
      ])
    ).toThrow(
      `description must be at most ${CHATBOT_CUSTOM_MODE_DESCRIPTION_MAX_LENGTH}`
    )
    expect(() =>
      parseModes([
        {
          name: 'Mode',
          personaText: 'x'.repeat(CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH + 1),
        },
      ])
    ).toThrow(
      `personaText must be at most ${CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH}`
    )
  })

  it('rejects more than five modes per chatbot', () => {
    expect(() =>
      parseModes(
        Array.from({ length: 6 }, (_, index) => ({ name: `Mode ${index}` }))
      )
    ).toThrow('at most 5 custom modes are supported')
    expect(
      parseModes(
        Array.from({ length: 5 }, (_, index) => ({ name: `Mode ${index}` }))
      ).modes
    ).toHaveLength(5)
  })

  it('rejects names colliding with the standard modes or with each other', () => {
    expect(() => parseModes([{ name: 'Tutor' }])).toThrow(
      'Mode name "Tutor" is reserved'
    )
    expect(() =>
      parseModes([{ name: 'Interview' }, { name: ' interview ' }])
    ).toThrow('Mode name "interview" is used more than once')
  })

  it('keeps a stored key stable across a rename', () => {
    const saved = parseModes([{ name: 'Interview coach' }])
    const renamed = parseModes(
      [{ key: saved.modes[0]?.key, name: 'Hiring panel' }],
      saved
    )

    expect(renamed.modes[0]?.key).toBe(saved.modes[0]?.key)
    expect(renamed.modes[0]?.name).toBe('Hiring panel')
  })

  it('assigns a fresh key to an unknown or forged key', () => {
    const saved = parseModes([{ name: 'Interview coach' }])
    const forged = parseModes(
      [{ key: 'cm_forged', name: 'Interview coach' }],
      saved
    )

    expect(forged.modes[0]?.key).not.toBe('cm_forged')
    expect(forged.modes[0]?.key).not.toBe(saved.modes[0]?.key)
  })

  it('normalizes malformed persisted values tolerantly on read', () => {
    expect(normalizeChatbotCustomModeConfig(null)).toBeNull()
    expect(normalizeChatbotCustomModeConfig('not-an-object')).toBeNull()
    expect(normalizeChatbotCustomModeConfig({ modes: 'nope' })).toBeNull()
    expect(normalizeChatbotCustomModeConfig({ modes: [] })).toEqual({
      modes: [],
    })

    // A malformed entry is dropped without discarding the valid neighbours.
    expect(
      normalizeChatbotCustomModeConfig({
        modes: [
          { key: 'cm_keep', name: 'Keep me' },
          { name: 'Missing key' },
          { key: 'cm_bad_name', name: '' },
          { key: 'cm_reserved', name: 'Explainer' },
        ],
      })
    ).toEqual({
      modes: [
        {
          key: 'cm_keep',
          name: 'Keep me',
          description: null,
          personaText: null,
        },
      ],
    })
  })
})
