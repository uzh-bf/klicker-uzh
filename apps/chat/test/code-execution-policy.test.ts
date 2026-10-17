import { afterEach, describe, expect, test, vi } from 'vitest'
import { normalizeCodeExecutionConfig } from '@/src/lib/code-runner/profiles'
import { parseModeOptions } from '@/src/lib/config/modes'
import { withCodeCardTool } from '@/src/lib/server/codeCardTool'
import { resolveEffectiveChatModeOptions } from '@/src/lib/server/effectiveChatModes'

const policy = { modes: { tutor: ['python-core', 'r-base'] } }

describe('browser code execution policy', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('fails closed on malformed configuration and unknown profiles', () => {
    expect(normalizeCodeExecutionConfig(null)).toEqual({})
    expect(normalizeCodeExecutionConfig({ modes: ['tutor'] })).toEqual({})
    expect(
      normalizeCodeExecutionConfig({
        modes: {
          tutor: 'python-core',
          explainer: ['javascript', 'r-base'],
          quizzer: [],
        },
      })
    ).toEqual({ explainer: ['r-base'] })
  })

  test('admits profiles only for the configured mode while the kill switch is on', () => {
    vi.stubEnv('CHAT_CODE_EXECUTION_ENABLED', 'true')
    const modes = resolveEffectiveChatModeOptions(null, [], null, {
      codeExecutionConfig: policy,
    })

    expect(modes.tutor?.codeProfiles).toEqual(['python-core', 'r-base'])
    expect(modes.explainer?.codeProfiles).toBeUndefined()
  })

  test('admits nothing while the kill switch is off', () => {
    vi.stubEnv('CHAT_CODE_EXECUTION_ENABLED', '')
    const modes = resolveEffectiveChatModeOptions(null, [], null, {
      codeExecutionConfig: policy,
    })

    expect(modes.tutor?.codeProfiles).toBeUndefined()
  })

  test('carries admitted profiles to the client and drops unknown values', () => {
    expect(
      parseModeOptions({
        tutor: { description: 'Tutor', codeProfiles: ['r-base', 'bash'] },
        explainer: { description: 'Explainer' },
      })
    ).toEqual({
      tutor: { description: 'Tutor', codeProfiles: ['r-base'] },
      explainer: { description: 'Explainer' },
    })
  })

  test('registers the card tool only for admitted profiles', async () => {
    expect(withCodeCardTool({}, undefined)).toEqual({})
    expect(withCodeCardTool({}, [])).toEqual({})

    const tools = withCodeCardTool({}, ['python-core'])
    const cardTool = tools.open_code_card
    expect(cardTool).toBeDefined()
    const schema = cardTool?.inputSchema as {
      safeParse: (value: unknown) => { success: boolean }
    }
    expect(
      schema.safeParse({ profile: 'python-core', starterCode: 'print(1)' })
        .success
    ).toBe(true)
    expect(
      schema.safeParse({ profile: 'r-base', starterCode: 'print(1)' }).success
    ).toBe(false)
    const execute = cardTool?.execute as (input: {
      profile: string
      starterCode: string
    }) => Promise<unknown>
    expect(
      await execute({ profile: 'python-core', starterCode: 'print(1)' })
    ).toEqual({
      kind: 'code-card',
      profile: 'python-core',
      starterCode: 'print(1)',
    })
  })
})
