import { ApolloError } from '@apollo/client'

export type AdaptiveTranslator = (
  key: string,
  values?: Record<string, string | number>
) => string

export function asAdaptiveTranslator(translator: unknown): AdaptiveTranslator {
  return translator as AdaptiveTranslator
}

export type AdaptiveReadinessIssueLike = {
  code: string
  message?: string | null
  assignmentId?: number | null
  nodeId?: number | null
  parameters?: {
    nodeName?: string | null
    elementName?: string | null
    field?: string | null
    minimumValue?: number | null
    maximumValue?: number | null
    targetItemCount?: number | null
    enabledAssignmentCount?: number | null
    requiredQuestionCount?: number | null
    availableItemCount?: number | null
    effectiveQuestionCap?: number | null
    totalQuestionCap?: number | null
    classifiableLevelCount?: number | null
    levelCount?: number | null
    estimatedDurationMinutes?: number | null
    secondsPerItem?: number | null
    assignmentId?: number | null
    nodeId?: number | null
  } | null
}

export function formatAdaptiveReadinessIssue(
  t: AdaptiveTranslator,
  issue: AdaptiveReadinessIssueLike
): string {
  const p = issue.parameters ?? {}
  switch (issue.code) {
    case 'ADAPTIVE_COURSE_DISABLED':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_COURSE_DISABLED'
      )
    case 'ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE'
      )
    case 'ADAPTIVE_NO_ENABLED_COMPETENCE':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_NO_ENABLED_COMPETENCE'
      )
    case 'ADAPTIVE_COMPETENCE_WITHOUT_ENABLED_LEAF':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_COMPETENCE_WITHOUT_ENABLED_LEAF',
        { nodeName: p.nodeName ?? '' }
      )
    case 'ADAPTIVE_ITEM_UNAVAILABLE':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_ITEM_UNAVAILABLE',
        { elementName: p.elementName ?? '' }
      )
    case 'ADAPTIVE_ITEM_ACCESS_REVOKED':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_ITEM_ACCESS_REVOKED',
        { elementName: p.elementName ?? '' }
      )
    case 'ADAPTIVE_ITEM_NOT_SCORABLE':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_ITEM_NOT_SCORABLE',
        { elementName: p.elementName ?? '' }
      )
    case 'ADAPTIVE_ITEM_PARAMETERS_INVALID':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_ITEM_PARAMETERS_INVALID',
        { elementName: p.elementName ?? '' }
      )
    case 'ADAPTIVE_COVERAGE_CELL_EMPTY':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_COVERAGE_CELL_EMPTY'
      )
    case 'ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM',
        {
          minimumValue: p.minimumValue ?? 0,
          enabledAssignmentCount: p.enabledAssignmentCount ?? 0,
        }
      )
    case 'ADAPTIVE_COVERAGE_BELOW_TARGET':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_COVERAGE_BELOW_TARGET',
        {
          targetItemCount: p.targetItemCount ?? 0,
          enabledAssignmentCount: p.enabledAssignmentCount ?? 0,
        }
      )
    case 'ADAPTIVE_MINIMUM_EVIDENCE_UNREACHABLE':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_MINIMUM_EVIDENCE_UNREACHABLE',
        {
          nodeName: p.nodeName ?? '',
          requiredQuestionCount: p.requiredQuestionCount ?? 0,
          availableItemCount: p.availableItemCount ?? 0,
        }
      )
    case 'ADAPTIVE_MINIMUM_EVIDENCE_CAPPED':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_MINIMUM_EVIDENCE_CAPPED',
        {
          nodeName: p.nodeName ?? '',
          requiredQuestionCount: p.requiredQuestionCount ?? 0,
          effectiveQuestionCap: p.effectiveQuestionCap ?? 0,
        }
      )
    case 'ADAPTIVE_GLOBAL_MINIMUM_EVIDENCE_CAPPED':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_GLOBAL_MINIMUM_EVIDENCE_CAPPED',
        {
          requiredQuestionCount: p.requiredQuestionCount ?? 0,
          totalQuestionCap: p.totalQuestionCap ?? 0,
        }
      )
    case 'ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE',
        {
          nodeName: p.nodeName ?? '',
          classifiableLevelCount: p.classifiableLevelCount ?? 0,
          levelCount: p.levelCount ?? 0,
        }
      )
    case 'ADAPTIVE_TIME_BUDGET_EXCEEDED':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_TIME_BUDGET_EXCEEDED',
        {
          estimatedDurationMinutes: p.estimatedDurationMinutes ?? 0,
          secondsPerItem: p.secondsPerItem ?? 0,
        }
      )
    case 'ADAPTIVE_CONFIG_INTEGER_RANGE':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_CONFIG_INTEGER_RANGE',
        {
          field: p.field ?? '',
          minimumValue: p.minimumValue ?? 0,
          maximumValue: p.maximumValue ?? 0,
        }
      )
    case 'ADAPTIVE_PER_LEAF_CAP_INVALID':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_PER_LEAF_CAP_INVALID',
        { totalQuestionCap: p.totalQuestionCap ?? 0 }
      )
    case 'ADAPTIVE_MIN_QUESTIONS_EXCEEDS_TOTAL':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_MIN_QUESTIONS_EXCEEDS_TOTAL',
        { totalQuestionCap: p.totalQuestionCap ?? 0 }
      )
    case 'ADAPTIVE_CLASSIFICATION_Z_INVALID':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_CLASSIFICATION_Z_INVALID',
        { maximumValue: p.maximumValue ?? 0 }
      )
    case 'ADAPTIVE_TOP_INFORMATION_RATIO_INVALID':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_TOP_INFORMATION_RATIO_INVALID',
        { maximumValue: p.maximumValue ?? 0 }
      )
    case 'ADAPTIVE_DEFAULT_DISCRIMINATION_INVALID':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_DEFAULT_DISCRIMINATION_INVALID',
        { maximumValue: p.maximumValue ?? 0 }
      )
    case 'ADAPTIVE_STACKS_FORBIDDEN':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_STACKS_FORBIDDEN'
      )
    case 'ADAPTIVE_RESEARCH_SETTINGS_FORBIDDEN':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_RESEARCH_SETTINGS_FORBIDDEN'
      )
    case 'ADAPTIVE_ASSIGNMENT_INVALID':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_ASSIGNMENT_INVALID',
        { assignmentId: p.assignmentId ?? issue.assignmentId ?? 0 }
      )
    case 'ADAPTIVE_NODE_OVERRIDE_INVALID':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_NODE_OVERRIDE_INVALID',
        { nodeId: p.nodeId ?? issue.nodeId ?? 0 }
      )
    case 'ADAPTIVE_NON_ROOT_WEIGHT_FORBIDDEN':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_NON_ROOT_WEIGHT_FORBIDDEN'
      )
    case 'ADAPTIVE_NODE_CAP_INVALID':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_NODE_CAP_INVALID',
        { maximumValue: p.maximumValue ?? 0 }
      )
    case 'ADAPTIVE_ELEMENT_OVERRIDE_INVALID':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_ELEMENT_OVERRIDE_INVALID',
        { assignmentId: p.assignmentId ?? issue.assignmentId ?? 0 }
      )
    case 'ADAPTIVE_DISCRIMINATION_OVERRIDE_FORBIDDEN':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_DISCRIMINATION_OVERRIDE_FORBIDDEN'
      )
    case 'ADAPTIVE_DISCRIMINATION_OVERRIDE_INVALID':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_DISCRIMINATION_OVERRIDE_INVALID',
        { maximumValue: p.maximumValue ?? 0 }
      )
    case 'ADAPTIVE_ROOT_WEIGHT_INVALID':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_ROOT_WEIGHT_INVALID',
        { nodeName: p.nodeName ?? '' }
      )
    case 'ADAPTIVE_CONFIG_MISSING':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_CONFIG_MISSING'
      )
    case 'ADAPTIVE_V2_SCALE_NOT_ACTIVE':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_V2_SCALE_NOT_ACTIVE'
      )
    case 'ADAPTIVE_V2_PLACEMENT_UNAVAILABLE':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_V2_PLACEMENT_UNAVAILABLE'
      )
    case 'ADAPTIVE_V2_CALIBRATION_MISSING':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_V2_CALIBRATION_MISSING',
        { elementName: p.elementName ?? '' }
      )
    case 'ADAPTIVE_V2_CALIBRATION_VERSION_MISMATCH':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_V2_CALIBRATION_VERSION_MISMATCH',
        { elementName: p.elementName ?? '' }
      )
    case 'ADAPTIVE_V2_CALIBRATION_FLAGGED':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_V2_CALIBRATION_FLAGGED',
        { elementName: p.elementName ?? '' }
      )
    case 'ADAPTIVE_V2_INFORMATION_GAP':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_V2_INFORMATION_GAP'
      )
    case 'ADAPTIVE_V2_CUT_SCORE_UNREACHABLE':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_V2_CUT_SCORE_UNREACHABLE'
      )
    case 'ADAPTIVE_V2_RESEARCH_ANCHORS_REQUIRED':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_V2_RESEARCH_ANCHORS_REQUIRED'
      )
    case 'ADAPTIVE_V2_RESEARCH_DESIGN_DISCONNECTED':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_V2_RESEARCH_DESIGN_DISCONNECTED'
      )
    case 'ADAPTIVE_V2_EMPIRICAL_VALIDATION_REQUIRED':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_V2_EMPIRICAL_VALIDATION_REQUIRED'
      )
    case 'ADAPTIVE_V2_EMPIRICAL_VALIDATION_FAILED':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_V2_EMPIRICAL_VALIDATION_FAILED'
      )
    case 'ADAPTIVE_V2_EMPIRICAL_VALIDATION_STALE':
      return t(
        'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_V2_EMPIRICAL_VALIDATION_STALE'
      )
    default:
      return (
        issue.message ??
        t('manage.activityWizard.adaptive.readiness.issues.unknown')
      )
  }
}

export function formatAdaptiveApolloError(
  t: AdaptiveTranslator,
  error: unknown
): string {
  if (!(error instanceof ApolloError)) {
    return error instanceof Error ? error.message : String(error)
  }

  const details = error.graphQLErrors.flatMap((graphQLError) => {
    const issues = graphQLError.extensions?.issues
    if (!Array.isArray(issues)) return []
    return issues
      .filter(isAdaptiveReadinessIssue)
      .map((issue) => formatAdaptiveReadinessIssue(t, issue))
  })
  const rolloutDisabled = error.graphQLErrors.some(
    (graphQLError) =>
      graphQLError.extensions?.code === 'ADAPTIVE_COURSE_DISABLED'
  )
  if (rolloutDisabled) {
    return t(
      'manage.activityWizard.adaptive.readiness.issues.ADAPTIVE_COURSE_DISABLED'
    )
  }
  return details.length > 0 ? details.join('; ') : error.message
}

function isAdaptiveReadinessIssue(
  value: unknown
): value is AdaptiveReadinessIssueLike {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as { code?: unknown }).code === 'string'
  )
}
