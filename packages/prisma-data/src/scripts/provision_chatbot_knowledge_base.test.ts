import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  buildSnapshot,
  DOC_QUERY_TOOL_ALIAS,
  equalJson,
  ProvisionFailure,
  type ProvisionState,
  parseArgs,
  parseSnapshot,
  planProvision,
  projectDocQueryParameters,
} from './lib/chatbotKnowledgeBaseScope.js'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const OWNER_EMAIL = 'synthetic-owner@synthetic.invalid'
const OTHER_OWNER_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_OWNER_EMAIL = 'synthetic-other@synthetic.invalid'
const COURSE_ID = '33333333-3333-4333-8333-333333333333'
const CHATBOT_ID = '44444444-4444-4444-8444-444444444444'
const KB_ID = '55555555-5555-4555-8555-555555555555'
const FOREIGN_KB_ID = '66666666-6666-4666-8666-666666666666'
const CONFLICT_KB_ID = '77777777-7777-4777-8777-777777777777'
const LEGACY_SERVER_ID = '99999999-9999-4999-8999-999999999999'
const TUTOR_CONFIG_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const EXPLAINER_CONFIG_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const LEGACY_CONFIG_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
const KB_NAME = 'Synthetic Provision Scope KB'
const LEGACY_SERVER_NAME = 'Synthetic Legacy Doc Query'
const PHANTOM_KB_PARAMETERS = {
  kb_id: KB_ID,
  required: true,
  toolAlias: DOC_QUERY_TOOL_ALIAS,
}

function baseState(overrides: Partial<ProvisionState> = {}): ProvisionState {
  return {
    chatbot: {
      id: CHATBOT_ID,
      name: 'Synthetic Provision Scope Chatbot',
      ownerId: OWNER_ID,
      courseId: COURSE_ID,
      courseOwnerId: OWNER_ID,
    },
    owner: { id: OWNER_ID, email: OWNER_EMAIL },
    kbById: null,
    kbNameConflictIds: [],
    bindings: [],
    kbServerConfigs: [
      {
        id: TUTOR_CONFIG_ID,
        chatMode: 'tutor',
        isEnabled: true,
        allowedTools: [DOC_QUERY_TOOL_ALIAS],
        parameters: PHANTOM_KB_PARAMETERS,
      },
      {
        id: EXPLAINER_CONFIG_ID,
        chatMode: 'explainer',
        isEnabled: true,
        allowedTools: [DOC_QUERY_TOOL_ALIAS],
        parameters: PHANTOM_KB_PARAMETERS,
      },
    ],
    legacyServer: {
      id: LEGACY_SERVER_ID,
      name: LEGACY_SERVER_NAME,
      isActive: true,
    },
    legacyServerConfigs: [
      {
        id: LEGACY_CONFIG_ID,
        chatMode: 'tutor',
        isEnabled: true,
        allowedTools: ['synthetic_legacy'],
        parameters: {},
      },
    ],
    legacyServerOtherEnabledConfigs: 0,
    ...overrides,
  }
}

const TARGET = {
  kbId: KB_ID,
  kbName: KB_NAME,
  legacyServerName: LEGACY_SERVER_NAME,
}

describe('doc query scope projection', () => {
  it('projects a single bound knowledge base as the scalar kb_id claim', () => {
    expect(projectDocQueryParameters(PHANTOM_KB_PARAMETERS, [KB_ID])).toEqual({
      kb_id: KB_ID,
      required: true,
      toolAlias: DOC_QUERY_TOOL_ALIAS,
    })
  })

  it('projects several bound knowledge bases as a sorted kb_ids list', () => {
    const projected = projectDocQueryParameters(
      { kb_id: KB_ID, required: true, toolAlias: DOC_QUERY_TOOL_ALIAS },
      [FOREIGN_KB_ID, KB_ID]
    )
    expect(projected).toEqual({
      kb_ids: [KB_ID, FOREIGN_KB_ID].sort(),
      required: true,
      toolAlias: DOC_QUERY_TOOL_ALIAS,
    })
  })

  it('repairs a mixed representation without dropping unknown keys', () => {
    const projected = projectDocQueryParameters(
      {
        kb_id: FOREIGN_KB_ID,
        kb_ids: [FOREIGN_KB_ID],
        required: false,
        toolAlias: 'other',
        priority: 3,
      },
      [KB_ID]
    )
    expect(projected).toEqual({
      kb_id: KB_ID,
      required: true,
      toolAlias: DOC_QUERY_TOOL_ALIAS,
      priority: 3,
    })
  })

  it('refuses an empty scope', () => {
    expect(() => projectDocQueryParameters({}, [])).toThrow(ProvisionFailure)
  })

  it('compares parameter objects independent of key order', () => {
    expect(
      equalJson(
        { required: true, kb_id: KB_ID, toolAlias: DOC_QUERY_TOOL_ALIAS },
        PHANTOM_KB_PARAMETERS
      )
    ).toBe(true)
  })
})

describe('provision plan', () => {
  it('adopts the existing id without touching the parameters', () => {
    const plan = planProvision(baseState(), TARGET)
    expect(plan.refusal).toBeNull()
    expect(plan.createKb).toBe(true)
    expect(plan.createBinding).toBe(true)
    expect(
      plan.configUpdates.map(({ parametersChanged }) => parametersChanged)
    ).toEqual([false, false])
    expect(plan.legacyConfigDisables).toEqual([
      { id: LEGACY_CONFIG_ID, chatMode: 'tutor' },
    ])
    expect(plan.deactivateLegacyServer).toBe(true)
  })

  it('replays as a no-op once the knowledge base and binding exist', () => {
    const plan = planProvision(
      baseState({
        kbById: {
          id: KB_ID,
          name: KB_NAME,
          ownerId: OWNER_ID,
          deletedAt: null,
        },
        bindings: [{ id: randomUUID(), kbId: KB_ID, isEnabled: true }],
        legacyServer: {
          id: LEGACY_SERVER_ID,
          name: LEGACY_SERVER_NAME,
          isActive: false,
        },
        legacyServerConfigs: [
          {
            id: LEGACY_CONFIG_ID,
            chatMode: 'tutor',
            isEnabled: false,
            allowedTools: ['synthetic_legacy'],
            parameters: {},
          },
        ],
      }),
      TARGET
    )
    expect(plan.refusal).toBeNull()
    expect(plan.createKb).toBe(false)
    expect(plan.createBinding).toBe(false)
    expect(plan.legacyConfigDisables).toEqual([])
    expect(plan.deactivateLegacyServer).toBe(false)
  })

  const refusalCases: Array<[string, Partial<ProvisionState>]> = [
    ['chatbot_not_found', { chatbot: null }],
    ['owner_not_found', { owner: null }],
    [
      'owner_not_chatbot_owner',
      { owner: { id: OTHER_OWNER_ID, email: OTHER_OWNER_EMAIL } },
    ],
    [
      'course_owner_mismatch',
      {
        chatbot: {
          id: CHATBOT_ID,
          name: 'Synthetic Provision Scope Chatbot',
          ownerId: OWNER_ID,
          courseId: COURSE_ID,
          courseOwnerId: OTHER_OWNER_ID,
        },
      },
    ],
    [
      'kb_owner_mismatch',
      {
        kbById: {
          id: KB_ID,
          name: KB_NAME,
          ownerId: OTHER_OWNER_ID,
          deletedAt: null,
        },
      },
    ],
    [
      'kb_archived',
      {
        kbById: {
          id: KB_ID,
          name: KB_NAME,
          ownerId: OWNER_ID,
          deletedAt: new Date(),
        },
      },
    ],
    [
      'kb_name_mismatch',
      {
        kbById: {
          id: KB_ID,
          name: 'Renamed Threshold',
          ownerId: OWNER_ID,
          deletedAt: null,
        },
      },
    ],
    ['kb_name_conflict', { kbNameConflictIds: [CONFLICT_KB_ID] }],
    [
      'binding_conflict',
      {
        bindings: [{ id: randomUUID(), kbId: FOREIGN_KB_ID, isEnabled: true }],
      },
    ],
    ['kb_config_missing', { kbServerConfigs: [] }],
    [
      'kb_config_tools_invalid',
      {
        kbServerConfigs: [
          {
            id: TUTOR_CONFIG_ID,
            chatMode: 'tutor',
            isEnabled: true,
            allowedTools: ['other_tool'],
            parameters: PHANTOM_KB_PARAMETERS,
          },
        ],
      },
    ],
    [
      'kb_config_mode_duplicate',
      {
        kbServerConfigs: [
          {
            id: TUTOR_CONFIG_ID,
            chatMode: 'tutor',
            isEnabled: true,
            allowedTools: [DOC_QUERY_TOOL_ALIAS],
            parameters: PHANTOM_KB_PARAMETERS,
          },
          {
            id: EXPLAINER_CONFIG_ID,
            chatMode: 'tutor',
            isEnabled: true,
            allowedTools: [DOC_QUERY_TOOL_ALIAS],
            parameters: PHANTOM_KB_PARAMETERS,
          },
        ],
      },
    ],
    ['legacy_server_not_found', { legacyServer: null }],
  ]

  it.each(refusalCases)('refuses with %s', (code, overrides) => {
    const plan = planProvision(baseState(overrides), TARGET)
    expect(plan.refusal).toBe(code)
    expect(plan.configUpdates).toEqual([])
    expect(plan.legacyConfigDisables).toEqual([])
  })

  it('keeps a legacy server that other chatbots still enable', () => {
    const plan = planProvision(
      baseState({ legacyServerOtherEnabledConfigs: 1 }),
      TARGET
    )
    expect(plan.refusal).toBeNull()
    expect(plan.deactivateLegacyServer).toBe(false)
    expect(plan.legacyConfigDisables).toEqual([
      { id: LEGACY_CONFIG_ID, chatMode: 'tutor' },
    ])
  })
})

describe('provision arguments', () => {
  it('refuses a run without the required flags', () => {
    expect(() => parseArgs([])).toThrow(ProvisionFailure)
    expect(() => parseArgs(['--chatbot-id', CHATBOT_ID])).toThrow(
      ProvisionFailure
    )
  })

  it('refuses a non-canonical knowledge-base id', () => {
    try {
      parseArgs([
        '--chatbot-id',
        CHATBOT_ID,
        '--kb-id',
        'not-a-uuid',
        '--kb-name',
        KB_NAME,
        '--owner',
        OWNER_EMAIL,
      ])
      throw new Error('expected a refusal')
    } catch (error) {
      expect((error as ProvisionFailure).code).toBe('kb_id_invalid')
    }
  })

  it('requires a snapshot path for every apply', () => {
    const argv = [
      '--chatbot-id',
      CHATBOT_ID,
      '--kb-id',
      KB_ID,
      '--kb-name',
      KB_NAME,
      '--owner',
      OWNER_EMAIL,
    ]
    expect(() => parseArgs([...argv, '--apply'])).toThrow(ProvisionFailure)
    expect(
      parseArgs([...argv, '--apply', '--snapshot-out', '/tmp/x.json'])
    ).toMatchObject({ apply: true, snapshotPath: '/tmp/x.json' })
  })

  it('reads the rollback form', () => {
    expect(
      parseArgs(['--rollback', '--snapshot', '/tmp/x.json'])
    ).toMatchObject({ rollback: true, snapshotPath: '/tmp/x.json' })
    expect(() => parseArgs(['--rollback'])).toThrow(ProvisionFailure)
  })
})

describe('provision snapshot', () => {
  it('round-trips the pre-apply state', () => {
    const state = baseState()
    const plan = planProvision(state, TARGET)
    const snapshot = buildSnapshot(state, plan, {
      chatbotId: CHATBOT_ID,
      kbId: KB_ID,
      kbName: KB_NAME,
    })
    expect(snapshot.kbWasCreated).toBe(true)
    expect(snapshot.binding).toBeNull()
    expect(snapshot.configs).toHaveLength(2)
    expect(parseSnapshot(JSON.stringify(snapshot))).toEqual(snapshot)
  })

  it('refuses a snapshot from another contract version or shape', () => {
    expect(() => parseSnapshot('{')).toThrow(ProvisionFailure)
    expect(() => parseSnapshot('{"version":0}')).toThrow(ProvisionFailure)
  })
})

it('refuses to project over operator-owned shared grants', () => {
  const state = baseState()
  state.kbServerConfigs[0]!.parameters = {
    required: true,
    toolAlias: DOC_QUERY_TOOL_ALIAS,
    kb_ids: [KB_ID, FOREIGN_KB_ID],
    shared_kb_ids: [FOREIGN_KB_ID],
  }
  expect(planProvision(state, TARGET).refusal).toBe(
    'shared_kb_grants_require_operator'
  )
})
