export type ManageAssistantSkill = {
  enabled: boolean
  id: string
  instructions: string
  name: string
  priority: number
}

const TRIM_MARKER = '\n[trimmed]'
const DEFAULT_SKILL_PROMPT_BUDGET = 8_500
const DOCS_BASE_URL = 'https://www.klicker.uzh.ch'
const MEDIA_BASE_URL =
  'https://uzh.mediaspace.cast.switch.ch/embed/secure/iframe'

function docsUrl(path: string) {
  return `${DOCS_BASE_URL}${path}`
}

function imageUrl(path: string) {
  return `${DOCS_BASE_URL}${path}`
}

function mediaUrl(entryId: string) {
  return `${MEDIA_BASE_URL}/entryId/${entryId}/uiConfId/23448425/st/0`
}

const DOCS_NAVIGATOR_INSTRUCTIONS = [
  'Use this skill when lecturers ask how KlickerUZH works, where to find documentation, examples, tutorials, videos, screenshots, or pedagogical use cases.',
  'Prefer authoritative KlickerUZH documentation links. Use Markdown links in answers. When the lecturer asks to see an image, include a Markdown image using the absolute image URL below. For videos, link to the SWITCH MediaSpace embed URL.',
  'If the request is about live course/question data, use MCP tools first; if it is about how to use the product, answer from this documentation index. If no exact page is listed, point to the closest section and say it is the closest documented reference.',
  '',
  `Getting started: Core concepts ${docsUrl('/getting_started/core_concepts/')} covers elements, learning activities, courses, and gamification. Intro video: ${mediaUrl('0_ugtkafd3')}.`,
  `Use cases overview: ${docsUrl('/use_cases/')} groups interaction, engagement, and AI-enhanced learning scenarios.`,
  `Live Quiz: use case ${docsUrl('/use_cases/live_quiz/')} and tutorial ${docsUrl('/tutorials/live_quiz/')}. Videos: create ${mediaUrl('0_v85ndhpc')}, execute ${mediaUrl('0_o24idwtt')}. Images: ${imageUrl('/img/live_quiz/lq_student_view.png')}, ${imageUrl('/img/live_quiz/lq_evaluation.png')}.`,
  `Live Q&A and feedback: use case ${docsUrl('/use_cases/live_qa/')} and tutorial ${docsUrl('/tutorials/live_qa/')}. Video: ${mediaUrl('0_zya3eikh')}.`,
  `Microlearning: use case ${docsUrl('/use_cases/microlearning/')} and tutorial ${docsUrl('/tutorials/microlearning/')}. Videos: create ${mediaUrl('0_fpfksiyk')}, publish/evaluate ${mediaUrl('0_c80q9fnn')}. Image: ${imageUrl('/img/microlearning/ml_mobile_views.png')}.`,
  `Practice Quiz: use case ${docsUrl('/use_cases/practice_quiz/')} and tutorial ${docsUrl('/tutorials/practice_quiz/')}. Videos: prepare ${mediaUrl('0_6ewauv5u')}, publish/evaluate ${mediaUrl('0_afublry9')}. Images: ${imageUrl('/img/practice_quiz/pq_olat_view.png')}, ${imageUrl('/img/practice_quiz/activity_evaluation.png')}.`,
  `Group Activity: use case ${docsUrl('/use_cases/group_activity/')} and tutorial ${docsUrl('/tutorials/group_activity/')}. Videos: create ${mediaUrl('0_5sz1kqgj')}, grade ${mediaUrl('0_bbz7dszp')}. Images: ${imageUrl('/img/group_activity/ga_student_view.png')}, ${imageUrl('/img/group_activity/ga_grading_view.png')}.`,
  `Gamification: use case ${docsUrl('/use_cases/gamification/')}, overview ${docsUrl('/gamification/overview/')}, grading logic ${docsUrl('/gamification/grading_logic/')}, experience points ${docsUrl('/gamification/experience/')}. Image: ${imageUrl('/img/gamification/live_quiz_customized_grading.png')}.`,
  `Element types: ${docsUrl('/tutorials/supported_element_types/')} explains SC, MC, KPRIM, numerical, free text, selection, case study, content, and flashcards. Images: ${imageUrl('/img/supported_element_types/SC_lecturer.png')}, ${imageUrl('/img/supported_element_types/MC_student_sol.png')}, ${imageUrl('/img/supported_element_types/CS_evaluation_scatter.png')}.`,
  `Element management: ${docsUrl('/tutorials/element_management/')} explains creation, editing, duplication, library organization, sharing, and status/review workflows. Videos: create ${mediaUrl('0_m498vfjc')}, edit ${mediaUrl('0_4g3oc3a1')}. Images: ${imageUrl('/img/elements/MC_element_editor.png')}, ${imageUrl('/img/elements/library.png')}.`,
  `Element stacks and updates: stacks ${docsUrl('/tutorials/element_stacks/')} and activity updates ${docsUrl('/tutorials/element_updates_activities/')}. Update video: ${mediaUrl('0_2h6szy9a')}.`,
  `Answer collections: ${docsUrl('/tutorials/answer_collections/')} explains reusable answer pools for selection and case study questions. Videos: create ${mediaUrl('0_fugrvj6e')}, edit ${mediaUrl('0_ztlj2ej7')}. Image: ${imageUrl('/img/answer_collections/answer_collection_edit3.png')}.`,
  `Courses and integrations: course management ${docsUrl('/tutorials/course_management/')}, LTI ${docsUrl('/tutorials/lti_integration/')}, PowerPoint add-in ${docsUrl('/tutorials/ppt_integration/')}. Videos: course create ${mediaUrl('0_11ac1jx7')}, course edit ${mediaUrl('0_536w7eck')}, PowerPoint ${mediaUrl('0_1cv812a8')}.`,
  `Sharing and review: delegated access ${docsUrl('/tutorials/delegated_access/')}, review workflow ${docsUrl('/tutorials/review/')}, activity batch operations ${docsUrl('/tutorials/activity_batch_operations/')}, element batch operations ${docsUrl('/tutorials/element_batch_operations/')}.`,
  `Learning analytics use case: ${docsUrl('/use_cases/learning_analytics/')}. Images: ${imageUrl('/img/learning_analytics/la_activity_dashboard_example.png')}, ${imageUrl('/img/learning_analytics/la_students_dashboard.png')}.`,
  `AI-enhanced use cases: AI practice content ${docsUrl('/use_cases/ai_practice_content/')}, AI formative feedback ${docsUrl('/use_cases/ai_formative_feedback/')}, chatbot tutoring ${docsUrl('/use_cases/chatbot_tutoring/')}. Images: ${imageUrl('/img/use_cases/chatbot_data.png')}, ${imageUrl('/img/use_cases/chatbot_example.png')}.`,
].join('\n')

export const STATIC_MANAGE_ASSISTANT_SKILLS: ManageAssistantSkill[] = [
  {
    enabled: true,
    id: 'klicker-docs-navigator-v1',
    instructions: DOCS_NAVIGATOR_INSTRUCTIONS,
    name: 'Klicker Documentation Navigator',
    priority: 120,
  },
  {
    enabled: true,
    id: 'klicker-question-authoring-v1',
    instructions: [
      'For question authoring, produce assessment-ready drafts with clear wording, one tested concept, and plausible but unambiguous distractors.',
      'When the lecturer wants a persisted DRAFT question, gather only the missing essentials and then use the signed proposal tool so the lecturer can confirm creation.',
      'Keep feedback short and actionable. Explain why the correct answer is correct and why each distractor is not.',
      'Before presenting an SC or MC draft, verify every option-feedback pair against the stem and answer key: never reuse feedback across options or say a distractor is correct, and make each distractor explanation specific to that option.',
    ].join('\n'),
    name: 'Klicker Question Authoring',
    priority: 100,
  },
]

export function selectManageAssistantSkills(
  skills: ManageAssistantSkill[] = STATIC_MANAGE_ASSISTANT_SKILLS
) {
  return skills
    .filter((skill) => skill.enabled)
    .toSorted((left, right) => {
      if (left.priority !== right.priority)
        return right.priority - left.priority
      return left.name.localeCompare(right.name)
    })
}

function trimToBudget(text: string, maxChars: number) {
  if (text.length <= maxChars) return text
  if (maxChars <= TRIM_MARKER.length) return text.slice(0, maxChars)

  return `${text.slice(0, maxChars - TRIM_MARKER.length).trimEnd()}${TRIM_MARKER}`
}

export function buildManageAssistantSkillsPrompt(
  skills: ManageAssistantSkill[] = STATIC_MANAGE_ASSISTANT_SKILLS,
  options: { maxChars?: number } = {}
) {
  const selectedSkills = selectManageAssistantSkills(skills)
  if (selectedSkills.length === 0) return ''

  const prompt = [
    'Manage assistant skills. These are behavior instructions only; they do not grant permissions or add tools.',
    ...selectedSkills.map(
      (skill) => `Skill: ${skill.name} (${skill.id})\n${skill.instructions}`
    ),
  ].join('\n\n')

  return trimToBudget(prompt, options.maxChars ?? DEFAULT_SKILL_PROMPT_BUDGET)
}
