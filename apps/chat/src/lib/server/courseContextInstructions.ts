import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

/**
 * Formats server-sourced course metadata as data instead of instructions.
 * JSON serialization keeps control characters on one line and makes the value
 * boundary explicit even when a lecturer chose instruction-like course text.
 */
export function courseDataSection(courseDisplayName: string): string {
  const courseData = JSON.stringify({ displayName: courseDisplayName })

  return renderPromptTemplate('course-data', { courseData })
}
