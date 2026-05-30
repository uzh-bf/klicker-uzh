export type ManageAssistantSkill = {
  enabled: boolean
  id: string
  instructions: string
  name: string
  priority: number
}

const TRIM_MARKER = '\n[trimmed]'
const DEFAULT_SKILL_PROMPT_BUDGET = 2_400

export const STATIC_MANAGE_ASSISTANT_SKILLS: ManageAssistantSkill[] = [
  {
    enabled: true,
    id: 'klicker-question-authoring-v1',
    instructions: [
      'For question authoring, produce assessment-ready drafts with clear wording, one tested concept, and plausible but unambiguous distractors.',
      'When the lecturer wants a persisted DRAFT question, gather only the missing essentials and then use the signed proposal tool so the lecturer can confirm creation.',
      'Keep feedback short and actionable. Explain why the correct answer is correct and why each distractor is not.',
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
