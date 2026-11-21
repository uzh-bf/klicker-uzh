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
  })
  it('keeps tool and system guidance consistent in either mode', () => {
    const tools = { KB_doc_query: tool({ inputSchema: z.object({}) }) }
    const read = async () => Buffer.alloc(0)
    const baseline = withCourseImageTool(tools, ['kb'], read)
    expect(
      withCourseImageTool(tools, ['kb'], read, false).show_course_image
        ?.description
    ).toBe(baseline.show_course_image?.description)
    const enabled = withCourseImageTool(tools, ['kb'], read, true)
    expect(enabled.show_course_image?.description).not.toBe(
      baseline.show_course_image?.description
    )
  })
})
