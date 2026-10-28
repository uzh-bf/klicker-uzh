import { describe, expect, it } from 'vitest'
import {
  RESEARCH_EXPORT_CLASSES,
  RESEARCH_EXPORT_DISCLOSURE_VERSION,
  validateResearchExportRequest,
} from '../src/lib/researchExportRequest.js'

const now = new Date('2026-09-07T12:00:00.000Z')

function request() {
  return {
    requestId: '00000000-0000-4000-8000-000000000002',
    courseId: '00000000-0000-4000-8000-000000000001',
    projectTitle: 'Project',
    responsiblePerson: 'Researcher',
    contactEmail: 'researcher@example.org',
    purpose: 'Research purpose',
    deletionDate: '2026-09-07',
    selectedClasses: ['LIVE_QUIZ_RESPONSES'],
    acknowledgement: true,
    disclosureVersion: RESEARCH_EXPORT_DISCLOSURE_VERSION,
  }
}

describe('research export request validation', () => {
  it.each([
    '2026-02-29',
    '2026-09-7',
    '2026-13-01',
  ])('rejects an invalid deletion date: %s', (deletionDate) => {
    const result = validateResearchExportRequest(
      { ...request(), deletionDate },
      now
    )

    expect(result.success).toBe(false)
  })

  it('rejects a deletion date before the provided current date', () => {
    const result = validateResearchExportRequest(
      { ...request(), deletionDate: '2026-09-06' },
      now
    )

    expect(result.success).toBe(false)
  })

  it('treats a blank optional reference as omitted', () => {
    const result = validateResearchExportRequest(
      { ...request(), reference: '   ' },
      now
    )

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.reference).toBeUndefined()
  })

  it.each([
    ['acknowledgement', { acknowledgement: undefined }],
    ['unchecked acknowledgement', { acknowledgement: false }],
    ['disclosure version', { disclosureVersion: 'v0' }],
    ['selected classes', { selectedClasses: [] }],
  ] as const)('rejects a missing or stale %s value', (_field, override) => {
    const result = validateResearchExportRequest(
      { ...request(), ...override },
      now
    )

    expect(result.success).toBe(false)
  })

  it.each(
    RESEARCH_EXPORT_CLASSES
  )('accepts class selection %s', (selectedClass) => {
    const result = validateResearchExportRequest(
      { ...request(), selectedClasses: [selectedClass] },
      now
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.selectedClasses).toEqual([selectedClass])
    }
  })

  it('rejects duplicate and unsupported class selections', () => {
    const duplicate = validateResearchExportRequest(
      {
        ...request(),
        selectedClasses: ['LIVE_QUIZ_RESPONSES', 'LIVE_QUIZ_RESPONSES'],
      },
      now
    )
    const unsupported = validateResearchExportRequest(
      { ...request(), selectedClasses: ['UNSUPPORTED_CLASS'] },
      now
    )

    expect(duplicate.success).toBe(false)
    expect(unsupported.success).toBe(false)
  })
})
