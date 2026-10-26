/**
 * Label for a profile row without responses. The engine reports OUT_OF_RANGE
 * for a subcompetence it excluded because none of its questions lay within
 * the student's level range; every other untested row (for example NOT_SAMPLED
 * under subcompetence sampling, or attempts without a status) stays "Not
 * tested".
 */
export function getAdaptiveProfileNotTestedLabelKey(
  coverageStatus?: string | null
) {
  return coverageStatus === 'OUT_OF_RANGE'
    ? 'pwa.practiceQuiz.adaptive.profile.notTestedOutOfRange'
    : 'pwa.practiceQuiz.adaptive.profile.notTested'
}
