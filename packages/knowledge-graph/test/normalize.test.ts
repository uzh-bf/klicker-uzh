import { describe, expect, it } from 'vitest'

import {
  KNOWLEDGE_GRAPH_CONTENT_MAX_LENGTH,
  normalizeKnowledgeGraphEdge,
  normalizeKnowledgeGraphNode,
} from '../src/normalize.js'
import {
  exampleLectureEdgeRows,
  exampleLectureNodeRows,
  exampleLectureSources,
} from './fixtures/exampleLectureGraph.js'

describe('knowledge graph normalization', () => {
  it('normalizes the sanitized example graph using central precedence', () => {
    const sources = new Map(
      exampleLectureSources.map((source) => [source.resourceId, source])
    )

    expect(
      normalizeKnowledgeGraphNode(exampleLectureNodeRows[0]!, sources)
    ).toEqual({
      id: '12',
      labels: ['Methode'],
      kind: 'Method',
      displayLabel: 'Example method',
      content: 'A sanitized example method.',
      degree: 7,
      sourceReferences: [
        {
          resourceId: 'resource-security',
          title: 'Android security',
        },
      ],
    })

    expect(normalizeKnowledgeGraphEdge(exampleLectureEdgeRows[0]!)).toEqual({
      id: '91',
      source: '12',
      target: '27',
      type: 'RELATED',
      label: 'RELATED',
      properties: {
        weight: 0.91,
        description: 'Sanitized relationship description.',
        keywords: 'example,metric',
      },
    })
  })

  it('uses deterministic node fallbacks', () => {
    expect(
      normalizeKnowledgeGraphNode(
        { id: 42, labels: [], properties: {}, degree: -1 },
        new Map()
      )
    ).toEqual({
      id: '42',
      labels: [],
      kind: 'Concept',
      displayLabel: 'Concept 42',
      degree: 0,
      sourceReferences: [],
    })
  })

  it('uses the approved display, kind, and content property precedence', () => {
    const node = normalizeKnowledgeGraphNode(
      {
        id: 1,
        labels: ['FallbackKind'],
        properties: {
          name: 'Name',
          title: 'Title',
          entity: 'Entity',
          entity_type: 'ExplicitKind',
          description: 'Description',
          summary: 'Summary',
          content: 'Content',
          text: 'Text',
        },
        degree: 0,
      },
      new Map()
    )

    expect(node).toMatchObject({
      displayLabel: 'Name',
      kind: 'ExplicitKind',
      content: 'Description',
      summary: 'Summary',
    })
  })

  it('resolves and deduplicates known source IDs only', () => {
    const sources = new Map(
      exampleLectureSources.map((source) => [source.resourceId, source])
    )
    const node = normalizeKnowledgeGraphNode(
      {
        id: 1,
        labels: ['Concept'],
        properties: {
          source_id: [
            'resource-transcript',
            'unknown-resource',
            'resource-transcript',
          ],
          page_number: 8,
        },
        degree: 0,
      },
      sources
    )

    expect(node?.sourceReferences).toEqual([
      {
        resourceId: 'resource-transcript',
        title: 'Lecture transcript',
        reference: '8',
      },
    ])
  })

  it('caps content and removes sensitive, nested, binary, and non-finite edge data', () => {
    const node = normalizeKnowledgeGraphNode(
      {
        id: 1,
        labels: ['Concept'],
        properties: {
          description: 'x'.repeat(KNOWLEDGE_GRAPH_CONTENT_MAX_LENGTH + 100),
        },
        degree: 1,
      },
      new Map()
    )
    expect(node?.content).toHaveLength(KNOWLEDGE_GRAPH_CONTENT_MAX_LENGTH)

    const edge = normalizeKnowledgeGraphEdge({
      id: 9,
      source: 1,
      target: 2,
      type: 'RELATED_TO',
      properties: {
        confidence: 0.5,
        enabled: true,
        note: 'safe',
        generic: 'contains secret metadata',
        embedding: 'hidden',
        vector_score: 0.9,
        password_hint: 'hidden',
        accessToken: 'hidden',
        ingestion_run_id: 'hidden',
        source_url: 'https://example.test/document.pdf',
        signed: 'https://example.test/document.pdf?sv=1&sp=r&sig=secret',
        nested: { hidden: true },
        bytes: Buffer.from('hidden'),
        invalidNumber: Number.POSITIVE_INFINITY,
      },
    })

    expect(edge?.properties).toEqual({
      confidence: 0.5,
      enabled: true,
      note: 'safe',
    })
  })

  it('does not return SAS-like values from node display/content fields', () => {
    const signedUrl =
      'https://example.test/document.pdf?sv=1&se=tomorrow&sp=r&sig=secret'
    const node = normalizeKnowledgeGraphNode(
      {
        id: 4,
        labels: ['Concept'],
        properties: { name: signedUrl, description: signedUrl },
        degree: 0,
      },
      new Map()
    )

    expect(node).toMatchObject({
      displayLabel: 'Concept 4',
    })
    expect(node).not.toHaveProperty('content')
  })

  it('does not return secret-like top-level node or edge text', () => {
    const node = normalizeKnowledgeGraphNode(
      {
        id: 5,
        labels: ['secret token'],
        properties: {
          name: 'api_token=abc',
          title: 'Safe fallback title',
          entity_type: 'clientSecret=abc',
          summary: 'secret metadata',
          description: 'clientSecret=abc',
        },
        degree: 0,
      },
      new Map()
    )
    const edge = normalizeKnowledgeGraphEdge({
      id: 9,
      source: 5,
      target: 6,
      type: 'clientSecret=abc',
      properties: { label: 'api_token=abc' },
    })

    expect(node).toEqual({
      id: '5',
      labels: [],
      kind: 'Concept',
      displayLabel: 'Safe fallback title',
      degree: 0,
      sourceReferences: [],
    })
    expect(edge).toEqual({
      id: '9',
      source: '5',
      target: '6',
      type: 'RELATED_TO',
      label: 'RELATED_TO',
      properties: {},
    })
  })

  it('filters acronym-camel credentials without blocking safe lookalikes', () => {
    const node = normalizeKnowledgeGraphNode(
      {
        id: 6,
        labels: ['Konzept'],
        properties: {
          name: 'APISecret=abc',
          title: 'Tokenization overview',
          entity_type: 'JWTToken=abc',
          description: 'A secretary coordinates this example.',
        },
        degree: 1,
      },
      new Map()
    )
    const edge = normalizeKnowledgeGraphEdge({
      id: 10,
      source: 6,
      target: 7,
      type: 'JWTToken=abc',
      properties: { label: 'secretary' },
    })

    expect(node).toMatchObject({
      displayLabel: 'Tokenization overview',
      kind: 'Konzept',
      content: 'A secretary coordinates this example.',
    })
    expect(edge).toMatchObject({
      type: 'RELATED_TO',
      label: 'secretary',
      properties: { label: 'secretary' },
    })
  })
})
