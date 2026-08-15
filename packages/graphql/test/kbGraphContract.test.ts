import { describe, expect, it } from 'vitest'
import {
  KB_GRAPH_CONTRACT_VERSION,
  type KbGraphTerminalResult,
  validateKbGraphTerminalResult,
} from '../src/services/kbGraphContract.js'

const validResult: KbGraphTerminalResult = {
  contract_version: 'klicker-kb-graph/v1',
  result_id: '11111111-1111-4111-8111-111111111111:hatchet-run-001',
  build_id: '11111111-1111-4111-8111-111111111111',
  kb_id: '22222222-2222-4222-8222-222222222222',
  owner_id: '44444444-4444-4444-8444-444444444444',
  run_id: 'hatchet-run-001',
  source_content_digest:
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  graph_name:
    'klickeruzh:kb:22222222-2222-4222-8222-222222222222:11111111-1111-4111-8111-111111111111',
  status: 'SUCCEEDED',
  node_count: 10,
  edge_count: 20,
  processed_document_count: 3,
  failed_document_count: 0,
  error_code: null,
  graphml_artifact: {
    container_name: 'kb-44444444-4444-4444-8444-444444444444',
    blob_name: 'knowledge-graphs/11111111-1111-4111-8111-111111111111.graphml',
  },
  metered_cost: {
    currency: 'CHF',
    amount_minor_units: 120,
    components: [
      {
        provider: 'openai',
        model: 'gpt-5.6-luna',
        amount_minor_units: 120,
        pricing_version: '2026-08',
        input_tokens: 1000,
        output_tokens: 500,
        embedding_tokens: 0,
        request_count: 2,
      },
    ],
    metering_source: 'provider_reported',
  },
}

const validExpectation = {
  buildId: '11111111-1111-4111-8111-111111111111',
  kbId: '22222222-2222-4222-8222-222222222222',
  ownerId: '44444444-4444-4444-8444-444444444444',
  resultId: '11111111-1111-4111-8111-111111111111:hatchet-run-001',
  runId: 'hatchet-run-001',
  estimatedMinorUnits: 200,
}

describe('kbGraphContract', () => {
  it('exports the v1 contract version constant', () => {
    expect(KB_GRAPH_CONTRACT_VERSION).toBe('klicker-kb-graph/v1')
  })

  it('accepts a valid terminal result matching the expectation', () => {
    const validation = validateKbGraphTerminalResult(
      validResult,
      validExpectation
    )

    expect(validation.ok).toBe(true)
    if (validation.ok) {
      expect(validation.result.build_id).toBe(
        '11111111-1111-4111-8111-111111111111'
      )
      expect(validation.result.metered_cost?.amount_minor_units).toBe(120)
    }
  })

  it('rejects a result with a mismatched build id', () => {
    const validation = validateKbGraphTerminalResult(
      {
        ...validResult,
        build_id: '33333333-3333-4333-8333-333333333333',
        result_id: '33333333-3333-4333-8333-333333333333:hatchet-run-001',
        graph_name:
          'klickeruzh:kb:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333',
      },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('build_id mismatch')
    }
  })

  it('rejects a result with a mismatched kb id', () => {
    const validation = validateKbGraphTerminalResult(
      {
        ...validResult,
        kb_id: '55555555-5555-4555-8555-555555555555',
        graph_name:
          'klickeruzh:kb:55555555-5555-4555-8555-555555555555:11111111-1111-4111-8111-111111111111',
      },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('kb_id mismatch')
    }
  })

  it('rejects a result with a mismatched owner id', () => {
    const validation = validateKbGraphTerminalResult(
      {
        ...validResult,
        owner_id: '66666666-6666-4666-8666-666666666666',
      },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('owner_id mismatch')
    }
  })

  it('rejects a result with a mismatched result id', () => {
    const validation = validateKbGraphTerminalResult(
      {
        ...validResult,
        run_id: 'hatchet-run-002',
        result_id: '11111111-1111-4111-8111-111111111111:hatchet-run-002',
      },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('result_id mismatch')
    }
  })

  it('rejects a result with a mismatched run id', () => {
    const validation = validateKbGraphTerminalResult(
      {
        ...validResult,
        run_id: 'run-other',
        result_id: '11111111-1111-4111-8111-111111111111:run-other',
      },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('run_id mismatch')
    }
  })

  it('rejects a result with a malformed metered cost', () => {
    const validation = validateKbGraphTerminalResult(
      {
        ...validResult,
        metered_cost: {
          ...validResult.metered_cost!,
          amount_minor_units: -5,
        },
      },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('amount_minor_units')
    }
  })

  it('rejects a result with a negative node count', () => {
    const validation = validateKbGraphTerminalResult(
      { ...validResult, node_count: -1 },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('node_count')
    }
  })

  it('rejects a result with a non-integer edge count', () => {
    const validation = validateKbGraphTerminalResult(
      { ...validResult, edge_count: 1.5 },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('edge_count')
    }
  })

  it('rejects a result with a negative component amount', () => {
    const validation = validateKbGraphTerminalResult(
      {
        ...validResult,
        metered_cost: {
          ...validResult.metered_cost!,
          components: [
            {
              ...validResult.metered_cost!.components[0],
              amount_minor_units: -1,
            },
          ],
        },
      },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('amount_minor_units')
    }
  })

  it('rejects a result with a non-integer component token count', () => {
    const validation = validateKbGraphTerminalResult(
      {
        ...validResult,
        metered_cost: {
          ...validResult.metered_cost!,
          components: [
            {
              ...validResult.metered_cost!.components[0],
              input_tokens: 1.5,
            },
          ],
        },
      },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('input_tokens')
    }
  })

  it('rejects a result that exceeds the estimated reservation', () => {
    const validation = validateKbGraphTerminalResult(validResult, {
      ...validExpectation,
      estimatedMinorUnits: 100,
    })

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain(
        'exceeds estimated reservation'
      )
    }
  })

  it('accepts a result whose metered cost equals the reservation', () => {
    const validation = validateKbGraphTerminalResult(validResult, {
      ...validExpectation,
      estimatedMinorUnits: 120,
    })

    expect(validation.ok).toBe(true)
  })

  it('rejects a negative estimated reservation', () => {
    const validation = validateKbGraphTerminalResult(validResult, {
      ...validExpectation,
      estimatedMinorUnits: -1,
    })

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('estimatedMinorUnits')
    }
  })

  it('rejects a non-integer estimated reservation', () => {
    const validation = validateKbGraphTerminalResult(validResult, {
      ...validExpectation,
      estimatedMinorUnits: 1.5,
    })

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('estimatedMinorUnits')
    }
  })

  it('rejects a result with an unknown contract version', () => {
    const validation = validateKbGraphTerminalResult(
      { ...validResult, contract_version: 'klicker-kb-graph/v2' },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('contract_version')
    }
  })

  it('rejects a result with an unknown status', () => {
    const validation = validateKbGraphTerminalResult(
      { ...validResult, status: 'RUNNING' },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('status')
    }
  })

  it('rejects a result with an unknown extra property', () => {
    const validation = validateKbGraphTerminalResult(
      { ...validResult, unexpected_field: true },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain('unexpected_field')
    }
  })

  it('rejects a successful result without a graph artifact', () => {
    const validation = validateKbGraphTerminalResult(
      { ...validResult, graphml_artifact: null },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain(
        'SUCCEEDED results require a GraphML artifact'
      )
    }
  })

  it('rejects a non-success result without an error code', () => {
    const validation = validateKbGraphTerminalResult(
      { ...validResult, status: 'FAILED', error_code: null },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain(
        'non-success terminal results require error_code'
      )
    }
  })

  it('rejects metered components whose amounts do not add up', () => {
    const validation = validateKbGraphTerminalResult(
      {
        ...validResult,
        metered_cost: {
          ...validResult.metered_cost!,
          amount_minor_units: 121,
        },
      },
      validExpectation
    )

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.errors.join(' ')).toContain(
        'amount_minor_units must equal the component total'
      )
    }
  })
})
