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
import kgRelationsV1 from './fixtures/kgRelationsV1.json' with { type: 'json' }

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

    expect(
      normalizeKnowledgeGraphEdge(exampleLectureEdgeRows[0]!, sources)
    ).toEqual({
      id: '91',
      source: '12',
      target: '27',
      type: 'RELATED',
      label: 'RELATED',
      relationType: 'related',
      relationStatus: 'extracted',
      sourceReferences: [],
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

    const edge = normalizeKnowledgeGraphEdge(
      {
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
      },
      new Map()
    )

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
    const edge = normalizeKnowledgeGraphEdge(
      {
        id: 9,
        source: 5,
        target: 6,
        type: 'clientSecret=abc',
        properties: { label: 'api_token=abc' },
      },
      new Map()
    )

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
      relationType: 'related',
      relationStatus: 'extracted',
      sourceReferences: [],
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
    const edge = normalizeKnowledgeGraphEdge(
      {
        id: 10,
        source: 6,
        target: 7,
        type: 'JWTToken=abc',
        properties: { label: 'secretary' },
      },
      new Map()
    )

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

  // Synthetic row fixture from kg-content-generation MR !47 (54a46ac), the
  // cross-repository contract of kg-relations/v1. FalkorDB returns integer ids,
  // so the fixture's string ids are mapped to integers in fixture order.
  describe('kg-relations/v1 contract fixture', () => {
    const integerIds = new Map(
      [...kgRelationsV1.nodes, ...kgRelationsV1.edges].map((row, index) => [
        row.id,
        index + 1,
      ])
    )
    const sources = new Map([
      ['res-1', { resourceId: 'res-1', title: 'Synthetic slides' }],
      ['res-2', { resourceId: 'res-2', title: 'Synthetic notes' }],
    ])
    const nodes = kgRelationsV1.nodes.map((row) =>
      normalizeKnowledgeGraphNode(
        { ...row, id: integerIds.get(row.id) },
        sources
      )
    )
    const edges = Object.fromEntries(
      kgRelationsV1.edges.map((row) => [
        row.id,
        normalizeKnowledgeGraphEdge(
          {
            ...row,
            id: integerIds.get(row.id),
            source: integerIds.get(row.source),
            target: integerIds.get(row.target),
          },
          sources
        ),
      ])
    )
    const slides = { resourceId: 'res-1', title: 'Synthetic slides' }
    const notes = { resourceId: 'res-2', title: 'Synthetic notes' }

    it('reads relation types and statuses, with legacy edges untyped', () => {
      expect(
        Object.fromEntries(
          Object.entries(edges).map(([id, edge]) => [
            id,
            [edge?.relationType, edge?.relationStatus],
          ])
        )
      ).toEqual({
        rel_contrast: ['contrasts_with', 'inferred'],
        rel_formula: ['has_formula', 'inferred'],
        rel_legacy: ['related', 'extracted'],
        rel_part: ['part_of', 'source'],
        rel_prerequisite: ['prerequisite_of', 'inferred'],
        rel_related: ['related', 'extracted'],
        rel_synonym: ['synonym_of', 'source'],
      })
    })

    it('keeps the stored orientation of a flipped directed edge', () => {
      expect(edges.rel_part).toMatchObject({
        source: String(integerIds.get('node_factorial')),
        target: String(integerIds.get('node_binomial')),
      })
    })

    it('resolves concept and relation evidence to build sources and pages', () => {
      expect(edges.rel_part?.sourceReferences).toEqual([
        { ...slides, pages: [1, 2] },
        { ...notes, pages: [4] },
      ])
      expect(edges.rel_legacy?.sourceReferences).toEqual([
        { ...notes, pages: [4] },
      ])
      expect(edges.rel_related?.sourceReferences).toEqual([])
      expect(
        Object.fromEntries(
          nodes.map((node) => [node?.displayLabel, node?.sourceReferences])
        )
      ).toEqual({
        'Binomial Coefficient': [],
        Combination: [{ ...slides, pages: [7] }],
        'Counting Principle': [
          { ...slides, pages: [1, 2] },
          { ...notes, pages: [4] },
        ],
        Factorial: [{ ...notes, pages: [4] }],
        Permutation: [{ ...slides, pages: [1, 2] }],
      })
    })

    it('never serializes server-only evidence or raw relation keys', () => {
      const serialized = JSON.stringify({ nodes, edges })
      expect(serialized).not.toMatch(
        /internal_evidence_refs|internalEvidenceRefs|relation_type|relation_status|res-\d\||chunk-/
      )
    })
  })

  it('fails closed on relation values outside the contract', () => {
    const read = (properties: Record<string, unknown>) => {
      const edge = normalizeKnowledgeGraphEdge(
        { id: 1, source: 2, target: 3, type: 'RELATED', properties },
        new Map()
      )
      return [edge?.relationType, edge?.relationStatus]
    }

    expect(
      read({ relation_type: 'part_of', relation_status: 'inferred' })
    ).toEqual(['part_of', 'inferred'])
    for (const properties of [
      { relation_type: 'causes', relation_status: 'inferred' },
      { relation_type: 'Part_of', relation_status: 'inferred' },
      { relation_type: 'part_of' },
      { relation_type: 'part_of', relation_status: 'extracted' },
      { relation_type: 'part_of', relation_status: 'instructor' },
      { relation_type: 'prerequisite_of', relation_status: 'source' },
      { relation_type: 'related', relation_status: 'source' },
      { relation_type: 'synonym_of', relation_status: 'extracted' },
      { relation_type: 'is_a', relation_status: 'instructor' },
    ]) {
      expect(read(properties)).toEqual(['related', 'extracted'])
    }
  })

  it('drops evidence outside the build sources and malformed pages', () => {
    const edge = normalizeKnowledgeGraphEdge(
      {
        id: 1,
        source: 2,
        target: 3,
        type: 'RELATED',
        properties: {
          internal_evidence_refs:
            'res-1|3,0,x,3,1;res-other|1;res-1|2;;|5;res-2',
        },
      },
      new Map([
        ['res-1', { resourceId: 'res-1', title: 'Slides' }],
        ['res-2', { resourceId: 'res-2', title: 'Notes' }],
      ])
    )

    expect(edge?.sourceReferences).toEqual([
      { resourceId: 'res-1', title: 'Slides', pages: [1, 2, 3] },
      { resourceId: 'res-2', title: 'Notes' },
    ])
  })
})
