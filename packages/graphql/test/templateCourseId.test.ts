import { normalizeTemplateCourseId } from '../src/services/templates.js'

describe('template course selection', () => {
  it('normalizes course-less template creation without querying a sentinel', () => {
    const courseId = 'c47e06ea-673c-4230-b4b1-b386f88a7dff'

    expect(normalizeTemplateCourseId(courseId)).toBe(courseId)
    expect(normalizeTemplateCourseId('no-course-selected')).toBeUndefined()
    expect(normalizeTemplateCourseId(null)).toBeUndefined()
  })
})
