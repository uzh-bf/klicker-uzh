import { toCsv } from '../attemptDiagnostics/adaptiveAttemptCsv'
import type {
  DryRun,
  DryRunStudent,
  DryRunWorkspace,
} from './adaptiveDryRunTypes'

const round = (value: number | null, digits = 3) =>
  value === null ? null : Number(value.toFixed(digits))

/** One row per simulated student and competence. */
export function buildDryRunStudentsCsv(
  run: DryRun,
  students: DryRunStudent[],
  workspace: DryRunWorkspace
) {
  const label = (id: number | null) =>
    id === null
      ? null
      : (workspace.levels.find((level) => level.id === id)?.label ?? null)
  const order = (id: number | null) =>
    id === null
      ? null
      : (workspace.levels.find((level) => level.id === id)?.order ?? null)
  const name = (nodeId: number) =>
    workspace.competences.find((competence) => competence.nodeId === nodeId)
      ?.name ?? `#${nodeId}`
  return toCsv([
    [
      'run',
      'student',
      'competence',
      'true_level',
      'reported_level',
      'level_difference',
      'theta',
      'standard_error',
      'determined',
      'questions',
      'flipped_answers',
      'stop_reason',
      'overall_level',
    ],
    ...students.flatMap((student) =>
      student.competences.map((competence) => {
        const trueLevelId =
          student.trueLevels.find(({ nodeId }) => nodeId === competence.nodeId)
            ?.levelId ?? null
        const reportedOrder = order(competence.levelId)
        const trueOrder = order(trueLevelId)
        return [
          run.number,
          student.index,
          name(competence.nodeId),
          label(trueLevelId),
          label(competence.levelId),
          reportedOrder === null || trueOrder === null
            ? null
            : reportedOrder - trueOrder,
          round(competence.theta),
          round(competence.standardError),
          competence.classified,
          student.questionCount,
          student.answers.filter(({ flipped }) => flipped).length,
          student.stopReason,
          label(student.overall.levelId),
        ]
      })
    ),
  ])
}

/** One row per simulated answer, like the attempt export. */
export function buildDryRunAnswersCsv(
  run: DryRun,
  students: DryRunStudent[],
  workspace: DryRunWorkspace
) {
  const items = new Map(workspace.items.map((item) => [item.poolItemId, item]))
  const levels = new Map(workspace.levels.map((level) => [level.id, level]))
  const label = (id: number | null | undefined) =>
    id == null ? null : (levels.get(id)?.label ?? null)
  return toCsv([
    [
      'run',
      'student',
      'order',
      'question',
      'competence_path',
      'question_level',
      'true_level',
      'expected_correct',
      'correct',
      'flipped',
      'level_after',
      'theta_after',
    ],
    ...students.flatMap((student) =>
      student.answers.map((answer, index) => {
        const item = items.get(answer.poolItemId)
        const trueLevelId =
          student.trueLevels.find(({ nodeId }) => nodeId === item?.rootId)
            ?.levelId ?? null
        return [
          run.number,
          student.index,
          index + 1,
          item?.elementName ?? `#${answer.poolItemId}`,
          item?.nodeNames.join(' > ') ?? null,
          label(answer.levelId),
          label(trueLevelId),
          trueLevelId === null
            ? null
            : levels.get(answer.levelId)!.order <=
              levels.get(trueLevelId)!.order,
          answer.correct,
          answer.flipped,
          label(answer.after?.levelId),
          round(answer.after?.theta ?? null),
        ]
      })
    ),
  ])
}
