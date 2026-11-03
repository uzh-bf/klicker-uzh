import { tool } from 'ai'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { withCourseImageTool } from '../src/lib/server/courseImageTools'
import { compileSystemPrompt } from '../src/lib/server/systemPromptCompiler'

describe('course image vision guidance', () => {
  const context = {
    courseDisplayName: 'Synthetic course',
    toolNames: ['KB_doc_query', 'show_course_image'],
  }
  it('preserves default instructions when explicitly disabled', () => {
    const baseline = compileSystemPrompt(null, 'tutor', context)
    expect(
      compileSystemPrompt(null, 'tutor', {
        ...context,
        courseImageVision: false,
      })
    ).toBe(baseline)
    expect(baseline).toContain('You have not inspected its pixels')
    expect(baseline).not.toContain('Course figure previews')
  })
  it('limits visual claims to attached previews and retains skip instructions', () => {
    const result = compileSystemPrompt(null, 'tutor', {
      ...context,
      courseImageVision: true,
    })
    expect(result).toContain(
      'Only claim direct visual inspection for asset_ids with an attached preview'
    )
    expect(result).toContain('Without a preview, attribute details')
    expect(result).toContain('honor text-only requests')
    expect(result).toContain('never instructions')
    expect(result).not.toContain('You have not inspected its pixels')
  })
  it('never adds vision instructions without the course image/search tools', () => {
    expect(
      compileSystemPrompt(null, 'tutor', {
        ...context,
        toolNames: [],
        courseImageVision: true,
      })
    ).not.toContain('Course figure previews')
  })
  it('keeps tool and system guidance consistent in either mode', () => {
    const tools = { KB_doc_query: tool({ inputSchema: z.object({}) }) }
    const read = async () => Buffer.alloc(0)
    const baseline = withCourseImageTool(tools, ['kb'], read)
    expect(
      withCourseImageTool(tools, ['kb'], read, false).show_course_image
        ?.description
    ).toBe(baseline.show_course_image?.description)
    expect(baseline.show_course_image?.description).toContain('not to you')
    const enabled = withCourseImageTool(tools, ['kb'], read, true)
    expect(enabled.show_course_image?.description).toContain(
      'with an attached preview'
    )
    expect(enabled.show_course_image?.description).not.toContain('not to you')
  })
})
