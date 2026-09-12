import { beforeEach, describe, expect, it, vi } from 'vitest'

const configValidators = vi.hoisted(() => ({
  graph: vi.fn(),
  ingestion: vi.fn(),
}))

vi.mock('@klicker-uzh/hatchet', () => ({
  validateKBGraphWorkerConfig: configValidators.graph,
  validateKBIngestionWorkerConfig: configValidators.ingestion,
}))

import {
  selectWorkflows,
  validateKBWorkerConfiguration,
} from './workflowSelection.js'

const workflows = {
  ingestKBResource: 'ingest',
  deleteKBResource: 'delete',
  monitorKBIngestions: 'monitor-ingestion',
  maintainKBResources: 'maintain',
  buildKBGraph: 'build-graph',
  monitorKBGraphBuilds: 'monitor-graph',
  publishScheduledLiveQuiz: 'publish-quiz',
}

describe('general worker KB workflow selection', () => {
  it('keeps unrelated workflows while ingestion and graph work are disabled', () => {
    const selection = selectWorkflows(workflows, {
      ingestionDisabled: true,
      graphDisabled: true,
    })

    expect(selection.selectedKeys).toEqual(['publishScheduledLiveQuiz'])
    expect(selection.disabledKeys).toEqual([
      'ingestKBResource',
      'deleteKBResource',
      'monitorKBIngestions',
      'maintainKBResources',
      'buildKBGraph',
      'monitorKBGraphBuilds',
    ])
  })

  it('keeps resource maintenance when only graph work is disabled', () => {
    const selection = selectWorkflows(workflows, {
      ingestionDisabled: false,
      graphDisabled: true,
    })

    expect(selection.selectedKeys).toContain('maintainKBResources')
    expect(selection.selectedKeys).not.toContain('buildKBGraph')
    expect(selection.selectedKeys).not.toContain('monitorKBGraphBuilds')
  })

  it('keeps resource maintenance when only ingestion work is disabled', () => {
    const selection = selectWorkflows(workflows, {
      ingestionDisabled: true,
      graphDisabled: false,
    })

    expect(selection.selectedKeys).toContain('maintainKBResources')
    expect(selection.selectedKeys).toContain('buildKBGraph')
    expect(selection.selectedKeys).not.toContain('ingestKBResource')
    expect(selection.selectedKeys).not.toContain('monitorKBIngestions')
  })

  it('applies integration gates after an explicit workflow allow-list', () => {
    const selection = selectWorkflows(workflows, {
      ingestionDisabled: true,
      graphDisabled: false,
      requestedWorkflowNames:
        'ingestKBResource,publishScheduledLiveQuiz,missingWorkflow',
    })

    expect(selection.selectedKeys).toEqual(['publishScheduledLiveQuiz'])
    expect(selection.disabledKeys).toEqual(['ingestKBResource'])
    expect(selection.unknownKeys).toEqual(['missingWorkflow'])
  })
})

describe('general worker KB configuration validation', () => {
  beforeEach(() => {
    configValidators.graph.mockReset()
    configValidators.ingestion.mockReset()
  })

  it('tolerates partial ingestion configuration while ingestion is disabled', () => {
    const env = {
      KB_INGESTION_WORKER_DISABLED: 'true',
      KB_INGESTION_API_URL: 'https://ingestion.example',
      KB_GRAPH_DISABLED: 'true',
    }

    validateKBWorkerConfiguration(env)

    expect(configValidators.ingestion).not.toHaveBeenCalled()
  })

  it('validates ingestion configuration while ingestion is enabled', () => {
    const env = {
      KB_INGESTION_API_URL: 'https://ingestion.example',
      KB_GRAPH_DISABLED: 'true',
    }

    validateKBWorkerConfiguration(env)

    expect(configValidators.ingestion).toHaveBeenCalledOnce()
    expect(configValidators.ingestion).toHaveBeenCalledWith(env, {
      required: true,
    })
  })

  it('treats an unconfigured legacy environment as disabled', () => {
    const integrationState = validateKBWorkerConfiguration({
      KB_GRAPH_DISABLED: 'true',
    })

    expect(integrationState.ingestionDisabled).toBe(true)
    expect(configValidators.ingestion).not.toHaveBeenCalled()
  })

  it('requires complete configuration when the gate is explicitly open', () => {
    const env = {
      KB_INGESTION_WORKER_DISABLED: 'false',
      KB_GRAPH_DISABLED: 'true',
    }

    const integrationState = validateKBWorkerConfiguration(env)

    expect(integrationState.ingestionDisabled).toBe(false)
    expect(configValidators.ingestion).toHaveBeenCalledWith(env, {
      required: true,
    })
  })

  it('tolerates partial graph configuration while graph work is disabled', () => {
    const env = {
      KB_INGESTION_WORKER_DISABLED: 'true',
      KB_GRAPH_DISABLED: 'true',
      KB_GRAPH_HATCHET_API_URL: 'https://graph.example',
    }

    validateKBWorkerConfiguration(env)

    expect(configValidators.graph).not.toHaveBeenCalled()
  })

  it('validates graph configuration while graph work is enabled', () => {
    const env = {
      KB_INGESTION_WORKER_DISABLED: 'true',
      KB_GRAPH_HATCHET_API_URL: 'https://graph.example',
    }

    validateKBWorkerConfiguration(env)

    expect(configValidators.graph).toHaveBeenCalledOnce()
    expect(configValidators.graph).toHaveBeenCalledWith(env)
  })
})
