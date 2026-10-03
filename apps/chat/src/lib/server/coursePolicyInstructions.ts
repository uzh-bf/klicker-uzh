import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'
import { isDocQueryToolName } from '@/src/lib/sources/normalizeSources'

/**
 * Non-removable platform policy for every course chatbot. This block supplies
 * the scope, evidence, privacy, integrity, and safety boundaries that must not
 * depend on a mode contract or lecturer-provided guidance.
 */
const COURSE_POLICY_CONTRACT = renderPromptTemplate('course-policy', {})

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
  toolNames: readonly string[]
): string {
  const trimmedBase = systemPrompt.trimEnd()
  const fixedPolicy = toolNames.some(isDocQueryToolName)
    ? `${COURSE_POLICY_CONTRACT}\n\n${COURSE_GROUNDING_CONTRACT}`
    : COURSE_POLICY_CONTRACT

  return trimmedBase.length > 0
    ? `${trimmedBase}\n\n${fixedPolicy}`
    : fixedPolicy
}
