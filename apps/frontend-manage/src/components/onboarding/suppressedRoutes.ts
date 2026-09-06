// Driver.js blocks pointer events on the entire document while an overlay is
// open. These are the routes where that would interrupt time-critical steering
// or grading work: the live quiz cockpit drives a running quiz, and the
// assessment live quiz page carries the point corrections. They show an overlay
// only when the lecturer asks for one; the values are Next.js route patterns as
// reported by `router.pathname`.
const AUTO_PRESENT_SUPPRESSED_ROUTES = new Set([
  '/quizzes/[id]/cockpit',
  '/courses/[id]/assessment/liveQuiz/[quizId]',
])

/**
 * Whether the page the lecturer is on must stay free of overlays nobody asked
 * for. Both the product-update spotlight and the onboarding tour ask this, so
 * that leaving the live session for an ordinary page brings them back.
 */
export function autoPresentSuppressed(pathname: string): boolean {
  return AUTO_PRESENT_SUPPRESSED_ROUTES.has(pathname)
}
