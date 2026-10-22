import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'
import { isDocQueryToolName } from '@/src/lib/sources/normalizeSources'

/**
 * Non-removable platform policy for every course chatbot. This block supplies
 * the scope, evidence, privacy, integrity, and safety boundaries that must not
 * depend on a mode contract or lecturer-provided guidance. The custom-persona
 * variant keeps the same protections but lets a lecturer-defined persona
 * decline protected requests in its own voice instead of breaking character.
 */
const COURSE_POLICY_CONTRACT = renderPromptTemplate('course-policy', {
  customPersona: false,
})
const CUSTOM_PERSONA_COURSE_POLICY_CONTRACT = renderPromptTemplate(
  'course-policy',
  { customPersona: true }
)

/**
 * Extra grounding rules for turns where a doc_query-style course retrieval
 * tool is available. Keeping this conditional avoids imposing retrieval
 * behaviour on chatbots without a course corpus.
 */
const COURSE_GROUNDING_CONTRACT = renderPromptTemplate('course-grounding', {})

/**
 * Appends the fixed course policy and, when applicable, the course-retrieval
 * grounding policy to `systemPrompt`.
 */
export function withCoursePolicyContract(
  systemPrompt: string,
  toolNames: readonly string[],
  customPersona = false
): string {
  const trimmedBase = systemPrompt.trimEnd()
  const coursePolicy = customPersona
    ? CUSTOM_PERSONA_COURSE_POLICY_CONTRACT
    : COURSE_POLICY_CONTRACT
  const fixedPolicy = toolNames.some(isDocQueryToolName)
    ? `${coursePolicy}\n\n${COURSE_GROUNDING_CONTRACT}`
    : coursePolicy

  return trimmedBase.length > 0
    ? `${trimmedBase}\n\n${fixedPolicy}`
    : fixedPolicy
}
