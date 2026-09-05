import type { KnowledgeGraphSourceMetadata } from '../../src/publication.js'
import type {
  KnowledgeGraphEdgeRow,
  KnowledgeGraphNodeRow,
} from '../../src/queries.js'

// Sanitized representative data using the property shape observed in the
// approved example-lecture graph. All identifiers and content below are fake.
export const exampleLectureSources: KnowledgeGraphSourceMetadata[] = [
  { resourceId: 'resource-transcript', title: 'Lecture transcript' },
  { resourceId: 'resource-security', title: 'Android security' },
]

export const exampleLectureNodeRows: KnowledgeGraphNodeRow[] = [
  {
    id: 12,
    labels: ['Methode'],
    properties: {
      name: 'Example method',
      entity_id: 'entity-example-method',
      entity_type: 'Method',
      description: 'A sanitized example method.',
      source_id: 'resource-security',
      file_path: 'https://example.test/document.pdf',
      created_at: '2026-07-20T00:00:00Z',
      truncate: false,
      degree: 7,
    },
    degree: 7,
  },
  {
    id: 27,
    labels: ['Kennzahl'],
    properties: {
      name: 'Example metric',
      entity_id: 'entity-example-metric',
      entity_type: 'Metric',
      description: 'A sanitized example metric.',
      source_id: ['resource-security', 'resource-transcript'],
      file_path: 'https://example.test/document.pdf',
      created_at: '2026-07-20T00:00:00Z',
      truncate: false,
      degree: 5,
    },
    degree: 5,
  },
  {
    id: 31,
    labels: ['Formel'],
    properties: {
      name: 'Example formula',
      entity_id: 'entity-example-formula',
      entity_type: 'Formula',
      description: 'A sanitized example formula.',
      source_id: 'resource-transcript',
      file_path: 'https://example.test/document.pdf',
      created_at: '2026-07-20T00:00:00Z',
      truncate: false,
      degree: 3,
    },
    degree: 3,
  },
  {
    id: 44,
    labels: ['Instrument'],
    properties: {
      name: 'Example instrument',
      entity_id: 'entity-example-instrument',
      entity_type: 'Instrument',
      description: 'A sanitized example instrument.',
      source_id: 'resource-security',
      file_path: 'https://example.test/document.pdf',
      created_at: '2026-07-20T00:00:00Z',
      truncate: false,
      degree: 2,
    },
    degree: 2,
  },
  {
    id: 58,
    labels: ['Konzept'],
    properties: {
      name: 'Example concept',
      entity_id: 'entity-example-concept',
      entity_type: 'Concept',
      description: 'A sanitized example concept.',
      source_id: 'resource-transcript',
      file_path: 'https://example.test/document.pdf',
      created_at: '2026-07-20T00:00:00Z',
      truncate: false,
      degree: 1,
    },
    degree: 1,
  },
]

export const exampleLectureEdgeRows: KnowledgeGraphEdgeRow[] = [
  {
    id: 91,
    source: 12,
    target: 27,
    type: 'RELATED',
    properties: {
      weight: 0.91,
      description: 'Sanitized relationship description.',
      keywords: 'example,metric',
      source_id: 'resource-security',
      file_path: 'https://example.test/document.pdf',
      created_at: '2026-07-20T00:00:00Z',
      truncate: false,
    },
  },
]
