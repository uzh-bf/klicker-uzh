const TOOL_LABELS: Record<string, string> = {
  klicker_student_capabilities: 'Checked practice capabilities',
  klicker_lecturer_capabilities: 'Checked assistant capabilities',
  klicker_lecturer_choices_draft: 'Drafted answer choices',
  klicker_lecturer_course_get: 'Opened course details',
  klicker_lecturer_course_list: 'Listed courses',
  klicker_lecturer_element_create_draft_proposal: 'Prepared draft proposal',
  klicker_lecturer_element_get: 'Opened question details',
  klicker_lecturer_element_search: 'Searched question pool',
  klicker_lecturer_feedback_draft: 'Drafted feedback',
  klicker_lecturer_question_draft: 'Drafted question preview',
}

export function formatToolName(raw: string) {
  const label = TOOL_LABELS[raw]
  if (label) return { server: null, tool: label }

  const sep = raw.indexOf('_')
  if (sep === -1) return { server: null, tool: raw }
  return {
    server: raw.slice(0, sep),
    tool: raw.slice(sep + 1).replace(/_/g, ' '),
  }
}
