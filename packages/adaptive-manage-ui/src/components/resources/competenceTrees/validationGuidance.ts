import type {
  CompetenceTreeForm,
  CompetenceTreeValidationIssueView,
} from './types'

const guidanceByCode = {
  ROOT_WITHOUT_SUBCOMPETENCE: 'missingSubcompetence',
  ROOT_WITHOUT_ENABLED_LEAF: 'missingEnabledSubcompetence',
  LEAF_WITHOUT_COVERAGE: 'missingCoverage',
  NODE_NAME_EMPTY: 'missingNodeName',
  NODE_DEPTH_OUT_OF_RANGE: 'nodeTooDeep',
  ROOT_WEIGHT_INVALID: 'invalidWeight',
  TREE_NAME_EMPTY: 'missingTreeName',
  TREE_DISPLAY_NAME_EMPTY: 'missingDisplayName',
  TREE_MAX_DEPTH_INVALID: 'invalidDepth',
  TREE_MAX_DEPTH_TOO_DEEP: 'invalidDepth',
  ROOT_COUNT_TOO_LOW: 'missingRoot',
  LEVEL_COUNT_TOO_LOW: 'missingLevels',
  LEVEL_COUNT_LOW: 'fewLevels',
  LEVEL_LABEL_EMPTY: 'missingLevelName',
  LEVEL_LABEL_DUPLICATE: 'duplicateLevelName',
  ASSIGNMENT_LEAF_MISSING: 'invalidAssignment',
  ASSIGNMENT_LEAF_NOT_LEAF: 'invalidAssignment',
  ASSIGNMENT_LEAF_KIND_INVALID: 'invalidAssignment',
  ASSIGNMENT_LEAF_OTHER_ROOT: 'additionalLeafOtherRoot',
  ASSIGNMENT_LEVEL_MISSING: 'missingAssignmentLevel',
  ASSIGNMENT_COVERAGE_MISSING: 'assignmentCoverage',
  ASSIGNMENT_COVERAGE_DISABLED: 'assignmentCoverage',
  COVERAGE_TARGET_INVALID: 'invalidCoverageTarget',
} as const

export function getValidationGuidance(
  issues: CompetenceTreeValidationIssueView[],
  form: CompetenceTreeForm
) {
  const emptyRoots = new Set(
    issues
      .filter((issue) => issue.code === 'ROOT_WITHOUT_SUBCOMPETENCE')
      .map((issue) => issue.path)
  )
  return issues
    .filter(
      (issue) =>
        !(
          ['LEAF_WITHOUT_COVERAGE', 'ROOT_WITHOUT_ENABLED_LEAF'].includes(
            issue.code
          ) && emptyRoots.has(issue.path)
        )
    )
    .map((issue) => {
      const [root, indexText] = (issue.path ?? '').split('.')
      const index =
        indexText && /^\d+$/.test(indexText) ? Number(indexText) : -1
      const node = root === 'nodes' ? form.nodes[index] : undefined
      const assignment =
        root === 'assignments' ? form.assignments[index] : undefined
      const level =
        root === 'levels'
          ? [...form.levels].sort((a, b) => a.order - b.order)[index]
          : undefined
      let section =
        root === 'nodes'
          ? 'nodes'
          : root === 'levels'
            ? 'levels'
            : root === 'coverages'
              ? 'coverages'
              : root === 'assignments'
                ? 'assignments'
                : root === 'maxDepth'
                  ? 'settings'
                  : 'metadata'
      if (
        [
          'LEAF_WITHOUT_COVERAGE',
          'ASSIGNMENT_COVERAGE_MISSING',
          'ASSIGNMENT_COVERAGE_DISABLED',
        ].includes(issue.code)
      )
        section = 'coverages'
      return {
        issue,
        messageKey: Object.hasOwn(guidanceByCode, issue.code)
          ? guidanceByCode[issue.code as keyof typeof guidanceByCode]
          : 'other',
        name: node?.name.trim() || assignment?.elementName || level?.label,
        nodeKey: section === 'nodes' ? node?.key : undefined,
        sectionId: `competence-tree-section-${section}`,
        actionKey:
          section === 'nodes'
            ? 'editCompetence'
            : section === 'levels'
              ? 'editLevels'
              : section === 'coverages' || section === 'settings'
                ? 'editSettings'
                : section === 'assignments'
                  ? 'editQuestions'
                  : 'editStructure',
      } as const
    })
}
