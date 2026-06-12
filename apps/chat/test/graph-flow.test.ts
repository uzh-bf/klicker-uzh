import type { ChatbotGraphSnapshot } from '@klicker-uzh/falkordb'
import { describe, expect, it } from 'vitest'
import { mapGraphSnapshotToFlow } from '../src/lib/graph/flow'

describe('mapGraphSnapshotToFlow', () => {
  it('maps graph snapshots to deterministic React Flow nodes and edges', () => {
    const snapshot: ChatbotGraphSnapshot = {
      nodes: [
        {
          id: '1',
          label: 'Finance',
          labels: ['PrototypeFinanceNode'],
          properties: {},
          depth: 0,
          kind: 'domain',
          summary: 'Root',
        },
        {
          id: '2',
          label: 'Corporate Finance',
          labels: ['PrototypeFinanceNode'],
          properties: {},
          depth: 1,
          kind: 'topic',
        },
        {
          id: '3',
          label: 'WACC',
          labels: ['PrototypeFinanceNode'],
          properties: {},
          depth: 2,
          formula: 'WACC = ...',
          kind: 'formula',
        },
      ],
      edges: [
        {
          id: 'e1',
          label: 'has topic',
          source: '1',
          target: '2',
          type: 'HAS_TOPIC',
          properties: {},
        },
        {
          id: 'e2',
          label: 'has concept',
          source: '2',
          target: '3',
          type: 'HAS_CONCEPT',
          properties: {},
        },
      ],
      truncated: false,
      limits: {
        edgeLimit: 150,
        nodeLimit: 100,
      },
    }

    const flow = mapGraphSnapshotToFlow(snapshot)

    expect(flow.nodes).toHaveLength(3)
    expect(flow.nodes[0]).toMatchObject({
      id: '1',
      data: {
        accent: '#0028a5',
        isDimmed: false,
        isRelated: false,
        isSelected: false,
        label: 'Finance',
        kind: 'domain',
        summary: 'Root',
      },
      position: {
        x: 0,
        y: 0,
      },
    })
    expect(flow.nodes[1]).toMatchObject({
      id: '2',
      data: {
        accent: '#1d4ed8',
        isDimmed: false,
        isRelated: false,
        isSelected: false,
        label: 'Corporate Finance',
        kind: 'topic',
      },
      position: {
        x: 0,
        y: -260,
      },
    })
    expect(flow.nodes[2]).toMatchObject({
      id: '3',
      data: {
        accent: '#67e8f9',
        formula: 'WACC = ...',
        isDimmed: false,
        isRelated: false,
        isSelected: false,
        label: 'WACC',
        kind: 'formula',
      },
      position: {
        x: 0,
        y: -410,
      },
    })
    expect(flow.edges).toHaveLength(2)
    expect(flow.edges[0]).toMatchObject({
      id: 'e1',
      source: '1',
      target: '2',
      type: 'straight',
      animated: false,
    })
  })

  it('does not draw non-hierarchy cross-links on the graph canvas', () => {
    const snapshot: ChatbotGraphSnapshot = {
      nodes: [
        {
          id: '1',
          label: 'Finance',
          labels: [],
          properties: {},
          depth: 0,
          kind: 'domain',
        },
        {
          id: '2',
          label: 'Corporate Finance',
          labels: [],
          properties: {},
          depth: 1,
          kind: 'topic',
        },
        {
          id: '3',
          label: 'WACC',
          labels: [],
          properties: {},
          depth: 2,
          kind: 'concept',
        },
        {
          id: '4',
          label: 'Free Cash Flow',
          labels: [],
          properties: {},
          depth: 2,
          kind: 'concept',
        },
      ],
      edges: [
        {
          id: 'topic',
          label: 'has topic',
          source: '1',
          target: '2',
          type: 'HAS_TOPIC',
          properties: {},
        },
        {
          id: 'concept-1',
          label: 'has concept',
          source: '2',
          target: '3',
          type: 'HAS_CONCEPT',
          properties: {},
        },
        {
          id: 'concept-2',
          label: 'has concept',
          source: '2',
          target: '4',
          type: 'HAS_CONCEPT',
          properties: {},
        },
        {
          id: 'cross-link',
          label: 'uses',
          source: '3',
          target: '4',
          type: 'USES',
          properties: {},
        },
      ],
      truncated: false,
      limits: {
        edgeLimit: 150,
        nodeLimit: 100,
      },
    }

    const flow = mapGraphSnapshotToFlow(snapshot)

    expect(flow.edges.map((edge) => edge.id)).toEqual([
      'topic',
      'concept-1',
      'concept-2',
    ])
  })

  it('does not use cross-links to place nodes in the hierarchy layout', () => {
    const snapshot: ChatbotGraphSnapshot = {
      nodes: [
        {
          id: '1',
          label: 'Finance',
          labels: [],
          properties: {},
          depth: 0,
          kind: 'domain',
        },
        {
          id: '2',
          label: 'Corporate Finance',
          labels: [],
          properties: {},
          depth: 1,
          kind: 'topic',
        },
        {
          id: '3',
          label: 'Accounting',
          labels: [],
          properties: {},
          depth: 1,
          kind: 'topic',
        },
        {
          id: '4',
          label: 'Balance Sheet',
          labels: [],
          properties: {},
          depth: 2,
          kind: 'concept',
        },
      ],
      edges: [
        {
          id: 'topic-1',
          label: 'has topic',
          source: '1',
          target: '2',
          type: 'HAS_TOPIC',
          properties: {},
        },
        {
          id: 'topic-2',
          label: 'has topic',
          source: '1',
          target: '3',
          type: 'HAS_TOPIC',
          properties: {},
        },
        {
          id: 'accounting-concept',
          label: 'has concept',
          source: '3',
          target: '4',
          type: 'HAS_CONCEPT',
          properties: {},
        },
        {
          id: 'cross-link',
          label: 'uses accounting statement',
          source: '2',
          target: '4',
          type: 'USES',
          properties: {},
        },
      ],
      truncated: false,
      limits: {
        edgeLimit: 150,
        nodeLimit: 100,
      },
    }

    const flow = mapGraphSnapshotToFlow(snapshot)

    expect(flow.nodes.find((node) => node.id === '4')?.position).toEqual({
      x: 0,
      y: 410,
    })
    expect(flow.edges.map((edge) => edge.id)).toEqual([
      'topic-1',
      'topic-2',
      'accounting-concept',
    ])
  })

  it('reveals selected non-hierarchy relations as visible focus edges', () => {
    const snapshot: ChatbotGraphSnapshot = {
      nodes: [
        {
          id: '1',
          label: 'Finance',
          labels: [],
          properties: {},
          depth: 0,
          kind: 'domain',
        },
        {
          id: '2',
          label: 'Corporate Finance',
          labels: [],
          properties: {},
          depth: 1,
          kind: 'topic',
        },
        {
          id: '3',
          label: 'WACC',
          labels: [],
          properties: {},
          depth: 2,
          kind: 'concept',
        },
        {
          id: '4',
          label: 'Free Cash Flow',
          labels: [],
          properties: {},
          depth: 2,
          kind: 'concept',
        },
      ],
      edges: [
        {
          id: 'topic',
          label: 'has topic',
          source: '1',
          target: '2',
          type: 'HAS_TOPIC',
          properties: {},
        },
        {
          id: 'concept',
          label: 'has concept',
          source: '2',
          target: '3',
          type: 'HAS_CONCEPT',
          properties: {},
        },
        {
          id: 'uses',
          label: 'uses',
          source: '3',
          target: '4',
          type: 'USES',
          properties: {},
        },
      ],
      truncated: false,
      limits: {
        edgeLimit: 150,
        nodeLimit: 100,
      },
    }

    const flow = mapGraphSnapshotToFlow(snapshot, { selectedNodeId: '3' })

    expect(flow.edges.map((edge) => edge.id)).toEqual([
      'topic',
      'concept',
      'uses',
    ])
    expect(flow.edges.find((edge) => edge.id === 'uses')).toMatchObject({
      label: 'uses',
      style: {
        stroke: '#0f766e',
        strokeDasharray: '6 5',
      },
    })
    expect(flow.nodes.find((node) => node.id === '4')?.data).toMatchObject({
      isRelated: true,
      isDimmed: false,
    })
  })

  it('dims nodes and edges outside the selected concept neighborhood', () => {
    const snapshot: ChatbotGraphSnapshot = {
      nodes: [
        {
          id: '1',
          label: 'Finance',
          labels: [],
          properties: {},
          depth: 0,
          kind: 'domain',
        },
        {
          id: '2',
          label: 'Corporate Finance',
          labels: [],
          properties: {},
          depth: 1,
          kind: 'topic',
        },
        {
          id: '3',
          label: 'WACC',
          labels: [],
          properties: {},
          depth: 2,
          kind: 'concept',
        },
        {
          id: '4',
          label: 'CAPM',
          labels: [],
          properties: {},
          depth: 2,
          kind: 'concept',
        },
      ],
      edges: [
        {
          id: 'e1',
          label: 'has topic',
          source: '1',
          target: '2',
          type: 'HAS_TOPIC',
          properties: {},
        },
        {
          id: 'e2',
          label: 'has concept',
          source: '2',
          target: '3',
          type: 'HAS_CONCEPT',
          properties: {},
        },
      ],
      truncated: false,
      limits: {
        edgeLimit: 150,
        nodeLimit: 100,
      },
    }

    const flow = mapGraphSnapshotToFlow(snapshot, { selectedNodeId: '3' })

    expect(flow.nodes.find((node) => node.id === '2')?.data).toMatchObject({
      isRelated: true,
      isDimmed: false,
    })
    expect(flow.nodes.find((node) => node.id === '4')?.data).toMatchObject({
      isRelated: false,
      isDimmed: true,
    })
    expect(flow.edges[1].style).toMatchObject({
      opacity: 1,
      strokeWidth: 2.25,
    })
  })
})
