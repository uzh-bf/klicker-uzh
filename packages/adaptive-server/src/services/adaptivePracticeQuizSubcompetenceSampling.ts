import type {
  AdaptiveConfiguredNode,
  AdaptiveReadinessIssue,
} from './adaptivePracticeQuizReadinessTypes.js'

/**
 * Subcompetence (matrix) sampling for the Diagnostic preset.
 *
 * Every enabled root competence receives its weight share of the total
 * question cap (the reachability allocation). When that share cannot cover
 * `minQuestionsPerLeaf` for every enabled leaf of the root, the engine serves
 * as many leaf blocks as fit, in a per-attempt random block order, so
 * different students cover different subcompetences. Leaves a student did not
 * receive are "not tested" for that student; the root estimate uses every
 * answer in that root.
 *
 * Sampling is only feasible when each root can receive at least one full leaf
 * block. Otherwise the minimum-evidence conflict stays a blocking error.
 */
export const ADAPTIVE_SUBCOMPETENCE_SAMPLING_CODE =
  'ADAPTIVE_SUBCOMPETENCE_SAMPLING'
export const ADAPTIVE_SUBCOMPETENCE_SAMPLING_UNREACHABLE_CODE =
  'ADAPTIVE_SUBCOMPETENCE_SAMPLING_UNREACHABLE'

export type AdaptiveRootSamplingPlan = {
  rootId: number
  rootName: string
  allocatedQuestionCount: number
  leafCount: number
  coveredLeafCount: number
  questionsPerLeaf: number
}

export function planAdaptiveSubcompetenceSampling({
  roots,
  enabledLeaves,
  rootByNode,
  rootAllocations,
  minQuestionsPerLeaf,
}: {
  roots: AdaptiveConfiguredNode[]
  enabledLeaves: AdaptiveConfiguredNode[]
  rootByNode: ReadonlyMap<number, number>
  rootAllocations: ReadonlyMap<number, number>
  minQuestionsPerLeaf: number
}): AdaptiveRootSamplingPlan[] {
  const questionsPerLeaf = Math.max(1, minQuestionsPerLeaf)
  return roots.map((root) => {
    const leafCount = enabledLeaves.filter(
      (leaf) => rootByNode.get(leaf.id) === root.id
    ).length
    const allocatedQuestionCount = rootAllocations.get(root.id) ?? 0
    return {
      rootId: root.id,
      rootName: root.name,
      allocatedQuestionCount,
      leafCount,
      coveredLeafCount: Math.min(
        leafCount,
        Math.floor(allocatedQuestionCount / questionsPerLeaf)
      ),
      questionsPerLeaf,
    }
  })
}

/**
 * Resolves the deferred minimum-evidence-vs-cap issues of a sampling quiz.
 * Returns blocking errors when any root cannot receive one leaf block, and
 * otherwise one advisory warning per root that is sampled.
 */
export function resolveAdaptiveSubcompetenceSampling({
  plans,
  deferredIssues,
}: {
  plans: AdaptiveRootSamplingPlan[]
  deferredIssues: AdaptiveReadinessIssue[]
}): { errors: AdaptiveReadinessIssue[]; warnings: AdaptiveReadinessIssue[] } {
  // Without a minimum-evidence conflict every leaf block fits; nothing to say.
  if (deferredIssues.length === 0) return { errors: [], warnings: [] }
  const unreachable = plans.filter(
    (plan) =>
      plan.leafCount > 0 && plan.allocatedQuestionCount < plan.questionsPerLeaf
  )
  if (unreachable.length > 0) {
    return {
      errors: [
        ...deferredIssues,
        ...unreachable.map((plan) => ({
          code: ADAPTIVE_SUBCOMPETENCE_SAMPLING_UNREACHABLE_CODE,
          message: `Competence ${plan.rootName} receives ${plan.allocatedQuestionCount} of the total question cap, fewer than the ${plan.questionsPerLeaf} questions needed to test one subcompetence.`,
          parameters: samplingParameters(plan),
          path: 'totalQuestionCap',
          nodeId: plan.rootId,
        })),
      ],
      warnings: [],
    }
  }
  return {
    errors: [],
    warnings: plans
      .filter((plan) => plan.coveredLeafCount < plan.leafCount)
      .map((plan) => ({
        code: ADAPTIVE_SUBCOMPETENCE_SAMPLING_CODE,
        message: `Each student is tested on about ${plan.coveredLeafCount} of ${plan.leafCount} ${plan.rootName} subcompetences (${plan.allocatedQuestionCount} questions, ${plan.questionsPerLeaf} per subcompetence).`,
        parameters: samplingParameters(plan),
        path: `nodes.${plan.rootId}`,
        nodeId: plan.rootId,
      })),
  }
}

function samplingParameters(plan: AdaptiveRootSamplingPlan) {
  return {
    rootName: plan.rootName,
    nodeName: plan.rootName,
    allocatedQuestionCount: plan.allocatedQuestionCount,
    leafCount: plan.leafCount,
    coveredLeafCount: plan.coveredLeafCount,
    questionsPerLeaf: plan.questionsPerLeaf,
  }
}
