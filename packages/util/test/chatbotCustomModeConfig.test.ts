import { describe, expect, it } from 'vitest'
import {
  CHATBOT_CUSTOM_MODE_DESCRIPTION_MAX_LENGTH,
  CHATBOT_CUSTOM_MODE_NAME_MAX_LENGTH,
  CHATBOT_CUSTOM_MODE_PERSONA_EXTENDED_MAX_LENGTH,
  CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH,
  CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_COUNT,
  CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_LENGTH,
  CHATBOT_CUSTOM_MODE_WELCOME_MESSAGE_MAX_LENGTH,
  normalizeChatbotCustomModeConfig,
  parseChatbotCustomModeConfigInput,
} from '../src/chatbotCustomModeConfig.js'

function parseModes(
  modes: Array<Record<string, unknown>>,
  existing: Parameters<typeof parseChatbotCustomModeConfigInput>[1]
) {
  return parseChatbotCustomModeConfigInput({ modes }, existing)
}

describe('chatbot custom mode configuration', () => {
  it('mints a server-side key and canonicalizes bounded fields', () => {
    const config = parseModes(
      [
        {
          name: '  Interview coach  ',
          description: '  Practices interview questions  ',
          personaText: '  You are an interview coach.\r\nStay encouraging.  ',
        },
      ],
      null
    )

    expect(config.modes).toHaveLength(1)
    const [mode] = config.modes
    expect(mode.key).toMatch(/^cm_/)
    expect(mode.name).toBe('Interview coach')
    expect(mode.description).toBe('Practices interview questions')
    expect(mode.personaText).toBe(
      'You are an interview coach.\nStay encouraging.'
    )
  })

  it('rejects over-long names, descriptions, persona text, and welcomes', () => {
    expect(() =>
      parseModes(
        [{ name: 'x'.repeat(CHATBOT_CUSTOM_MODE_NAME_MAX_LENGTH + 1) }],
        null
      )
    ).toThrow(`name must be at most ${CHATBOT_CUSTOM_MODE_NAME_MAX_LENGTH}`)
    expect(() =>
      parseModes(
        [
          {
            name: 'Mode',
            description: 'x'.repeat(
              CHATBOT_CUSTOM_MODE_DESCRIPTION_MAX_LENGTH + 1
            ),
          },
        ],
        null
      )
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
    expect(() =>
      parseModes(
        [
          {
            name: 'Mode',
            welcomeMessage: 'x'.repeat(
              CHATBOT_CUSTOM_MODE_WELCOME_MESSAGE_MAX_LENGTH + 1
            ),
          },
        ],
        null
      )
    ).toThrow(
      `welcomeMessage must be at most ${CHATBOT_CUSTOM_MODE_WELCOME_MESSAGE_MAX_LENGTH}`
    )
  })

  it('normalizes and round-trips an authored welcome message', () => {
    const created = parseModes(
      [
        {
          name: 'Interview coach',
          welcomeMessage: '  Hello!\r\nAsk me about interviews.  ',
        },
      ],
      null
    )
    const key = created.modes[0]?.key

    expect(created.modes[0]?.welcomeMessage).toBe(
      'Hello!\nAsk me about interviews.'
    )
    // Re-validating the stored configuration keeps the authored text.
    expect(
      parseModes(
        [
          {
            key,
            name: 'Interview coach',
            welcomeMessage: created.modes[0]?.welcomeMessage,
          },
        ],
        created
      ).modes[0]?.welcomeMessage
    ).toBe('Hello!\nAsk me about interviews.')
  })

  it('clears the stored welcome on an explicit null or blank write', () => {
    const stored = parseModes(
      [{ name: 'Interview coach', welcomeMessage: 'Hello there!' }],
      null
    )
    const key = stored.modes[0]?.key

    for (const cleared of [null, '   ']) {
      expect(
        parseModes(
          [
            {
              key,
              name: 'Interview coach',
              welcomeMessage: cleared,
            },
          ],
          stored
        ).modes[0]?.welcomeMessage ?? null
      ).toBeNull()
    }
  })

  it('preserves the stored welcome when a save omits the field', () => {
    const stored = parseModes(
      [{ name: 'Interview coach', welcomeMessage: 'Hello there!' }],
      null
    )
    const key = stored.modes[0]?.key

    const resaved = parseModes(
      [
        { key, name: 'Interview coach', description: 'Narrowed scope' },
        { name: 'Fresh mode' },
      ],
      stored
    )

    expect(resaved.modes[0]?.welcomeMessage).toBe('Hello there!')
    // A newly authored mode never inherits another mode's welcome.
    expect(resaved.modes[1]?.welcomeMessage ?? null).toBeNull()
  })

  it('hides participant reasoning unless a save explicitly shows it', () => {
    const created = parseModes(
      [{ name: 'Hidden by default' }, { name: 'Shown', showReasoning: true }],
      null
    )
    expect(created.modes.map((mode) => mode.showReasoning ?? false)).toEqual([
      false,
      true,
    ])

    const [hiddenKey, shownKey] = created.modes.map((mode) => mode.key)
    // Omission keeps the stored choice; false or null hides again.
    const resaved = parseModes(
      [
        { key: shownKey, name: 'Shown' },
        { key: hiddenKey, name: 'Hidden by default', showReasoning: null },
      ],
      created
    )
    expect(resaved.modes.map((mode) => mode.showReasoning ?? false)).toEqual([
      true,
      false,
    ])
    expect(
      parseModes(
        [{ key: shownKey, name: 'Shown', showReasoning: false }],
        created
      ).modes[0]?.showReasoning ?? false
    ).toBe(false)

    expect(() =>
      parseModes([{ name: 'Invalid', showReasoning: 'yes' }], null)
    ).toThrow('showReasoning must be a boolean or null')

    // A stored value other than an explicit true never reveals reasoning.
    expect(
      normalizeChatbotCustomModeConfig({
        modes: [
          { key: 'cm_truthy', name: 'Truthy', showReasoning: 'true' },
          { key: 'cm_true', name: 'True', showReasoning: true },
        ],
      })?.modes.map((mode) => mode.showReasoning ?? false)
    ).toEqual([false, true])
  })

  it('discards only an invalid stored welcome and keeps the mode', () => {
    const config = normalizeChatbotCustomModeConfig({
      modes: [
        { key: 'cm_number', name: 'Number welcome', welcomeMessage: 42 },
        {
          key: 'cm_long',
          name: 'Long welcome',
          welcomeMessage: 'x'.repeat(
            CHATBOT_CUSTOM_MODE_WELCOME_MESSAGE_MAX_LENGTH + 1
          ),
        },
        {
          key: 'cm_valid',
          name: 'Valid welcome',
          welcomeMessage: '  Hi\r\nthere  ',
        },
      ],
    })

    expect(config?.modes.map((mode) => mode.welcomeMessage ?? null)).toEqual([
      null,
      null,
      'Hi\nthere',
    ])
  })

  it('normalizes and round-trips authored starter prompts', () => {
    const created = parseModes(
      [
        {
          name: 'Interview coach',
          starterPrompts: [
            '  Ask about my last project.  ',
            'How do I prepare?\r\n',
          ],
        },
      ],
      null
    )
    const key = created.modes[0]?.key

    expect(created.modes[0]?.starterPrompts).toEqual([
      'Ask about my last project.',
      'How do I prepare?',
    ])
    expect(
      parseModes(
        [
          {
            key,
            name: 'Interview coach',
            starterPrompts: created.modes[0]?.starterPrompts,
          },
        ],
        created
      ).modes[0]?.starterPrompts
    ).toEqual(['Ask about my last project.', 'How do I prepare?'])
  })

  it('clears stored starter prompts on an explicit null or empty list', () => {
    const stored = parseModes(
      [{ name: 'Interview coach', starterPrompts: ['Keep me?'] }],
      null
    )
    const key = stored.modes[0]?.key

    for (const cleared of [null, []]) {
      expect(
        parseModes(
          [{ key, name: 'Interview coach', starterPrompts: cleared }],
          stored
        ).modes[0]?.starterPrompts ?? null
      ).toBeNull()
    }
  })

  it('preserves stored starter prompts when a save omits the field', () => {
    const stored = parseModes(
      [{ name: 'Interview coach', starterPrompts: ['Keep me?'] }],
      null
    )
    const key = stored.modes[0]?.key

    const resaved = parseModes(
      [
        { key, name: 'Interview coach', description: 'Narrowed scope' },
        { name: 'Fresh mode' },
      ],
      stored
    )

    expect(resaved.modes[0]?.starterPrompts).toEqual(['Keep me?'])
    expect(resaved.modes[1]?.starterPrompts ?? null).toBeNull()
  })

  it('filters invalid stored starter prompts and keeps the mode', () => {
    const config = normalizeChatbotCustomModeConfig({
      modes: [
        { key: 'cm_text', name: 'Not a list', starterPrompts: 'Ask me' },
        {
          key: 'cm_mixed',
          name: 'Mixed list',
          starterPrompts: [
            '  Keep one.  ',
            42,
            '',
            'x'.repeat(CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_LENGTH + 1),
            'Keep two.',
            'Keep three.',
            'Keep four.',
            'Dropped five.',
          ],
        },
      ],
    })

    expect(config?.modes.map((mode) => mode.starterPrompts ?? null)).toEqual([
      null,
      ['Keep one.', 'Keep two.', 'Keep three.', 'Keep four.'],
    ])
  })

  it('rejects malformed starter prompt writes', () => {
    expect(() =>
      parseModes([{ name: 'Mode', starterPrompts: 'Ask me' }], null)
    ).toThrow('starterPrompts must be an array')
    expect(() =>
      parseModes(
        [
          {
            name: 'Mode',
            starterPrompts: Array.from(
              { length: CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_COUNT + 1 },
              (_entry, index) => `Starter ${index}`
            ),
          },
        ],
        null
      )
    ).toThrow(
      `starterPrompts must contain at most ${CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_COUNT}`
    )
    expect(() =>
      parseModes([{ name: 'Mode', starterPrompts: [42] }], null)
    ).toThrow('starterPrompts entry 1 must be a string')
    expect(() =>
      parseModes([{ name: 'Mode', starterPrompts: ['   '] }], null)
    ).toThrow('starterPrompts entry 1 must not be empty')
    expect(() =>
      parseModes(
        [
          {
            name: 'Mode',
            starterPrompts: [
              'x'.repeat(CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_LENGTH + 1),
            ],
          },
        ],
        null
      )
    ).toThrow(
      `starterPrompts entry 1 must be at most ${CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_LENGTH}`
    )
  })

  it('applies the extended persona limit only to new or edited text', () => {
    const longPersona = 'x'.repeat(CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH + 1)
    const stored = parseChatbotCustomModeConfigInput(
      { modes: [{ name: 'Mode', personaText: longPersona }] },
      null,
      CHATBOT_CUSTOM_MODE_PERSONA_EXTENDED_MAX_LENGTH
    )
    const key = stored.modes[0]?.key

    expect(
      parseModes([{ key, name: 'Renamed', personaText: longPersona }], stored)
        .modes[0]?.personaText
    ).toBe(longPersona)
    expect(() =>
      parseModes(
        [{ key, name: 'Mode', personaText: `${longPersona}y` }],
        stored
      )
    ).toThrow(
      `personaText must be at most ${CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH}`
    )
    expect(() =>
      parseChatbotCustomModeConfigInput(
        {
          modes: [
            {
              name: 'Mode',
              personaText: 'x'.repeat(
                CHATBOT_CUSTOM_MODE_PERSONA_EXTENDED_MAX_LENGTH + 1
              ),
            },
          ],
        },
        null,
        CHATBOT_CUSTOM_MODE_PERSONA_EXTENDED_MAX_LENGTH
      )
    ).toThrow(
      `personaText must be at most ${CHATBOT_CUSTOM_MODE_PERSONA_EXTENDED_MAX_LENGTH}`
    )
  })

  it('rejects more than five modes per chatbot', () => {
    expect(() =>
      parseModes(
        Array.from({ length: 6 }, (_, index) => ({ name: `Mode ${index}` })),
        null
      )
    ).toThrow('at most 5 custom modes are supported')
    expect(
      parseModes(
        Array.from({ length: 5 }, (_, index) => ({ name: `Mode ${index}` })),
        null
      ).modes
    ).toHaveLength(5)
  })

  it('rejects names colliding with the standard modes or with each other', () => {
    expect(() => parseModes([{ name: 'Tutor' }], null)).toThrow(
      'Mode name "Tutor" is reserved'
    )
    expect(() =>
      parseModes([{ name: 'Interview' }, { name: ' interview ' }], null)
    ).toThrow('Mode name "interview" is used more than once')
  })

  it('keeps a stored key stable across a rename', () => {
    const saved = parseModes([{ name: 'Interview coach' }], null)
    const renamed = parseModes(
      [{ key: saved.modes[0]?.key, name: 'Hiring panel' }],
      saved
    )

    expect(renamed.modes[0]?.key).toBe(saved.modes[0]?.key)
    expect(renamed.modes[0]?.name).toBe('Hiring panel')
  })

  it('assigns a fresh key to an unknown or forged key', () => {
    const saved = parseModes([{ name: 'Interview coach' }], null)
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
