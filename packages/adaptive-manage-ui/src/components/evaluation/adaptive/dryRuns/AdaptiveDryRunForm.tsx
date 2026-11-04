import { faPlay, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Button, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import {
  CONFIDENCE_OPTIONS,
  type DryRun,
  type DryRunSettings,
  type DryRunWorkspace,
} from './adaptiveDryRunTypes'

export type DryRunFormValues = {
  students: number
  noiseProbability: number
  fromLevelId: number
  toLevelId: number
  competences: 'SAME_LEVEL' | 'INDEPENDENT'
  seed: string | null
  totalQuestionCap: number
  minQuestionsPerLeaf: number
  classificationZ: number
  classificationToleranceBands: number
}

const toInt = (value: string) =>
  /^\d+$/.test(value.trim()) ? Number(value.trim()) : null

const inputClass =
  'h-9 w-full rounded border border-gray-300 px-2 text-sm disabled:bg-gray-100 disabled:text-gray-500'

// One label style for every control, so the fields of a row line up.
function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="text-sm">
      <label
        htmlFor={htmlFor}
        className="mb-1 block truncate font-semibold text-gray-700"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-600">{hint}</p>
      ) : null}
    </div>
  )
}

// New dry run: simulated students and stop settings for this run only. The
// stop settings start from the published quiz; the quiz is never changed.
// With `sameStudentsAs`, the students of that run are kept (its seed, count,
// levels, competences and noise) and only the stop settings can change.
function AdaptiveDryRunForm({
  workspace,
  loading,
  onRun,
  sameStudentsAs,
  onNewStudents,
}: {
  workspace: DryRunWorkspace
  loading: boolean
  onRun: (values: DryRunFormValues) => void
  sameStudentsAs: DryRun | null
  onNewStudents: () => void
}) {
  const t = useTranslations()
  const defaults = (sameStudentsAs?.effectiveSettings ??
    workspace.defaults) as DryRunSettings
  const spec = sameStudentsAs?.spec
  const levels = workspace.levels
  const [students, setStudents] = useState(String(spec?.students ?? 100))
  const [noise, setNoise] = useState(
    Math.round((spec?.noiseProbability ?? 0.02) * 100)
  )
  const [mode, setMode] = useState<'EVEN' | 'FIXED'>(
    spec?.trueLevels.kind ?? 'EVEN'
  )
  const [fromLevelId, setFromLevelId] = useState(
    String(
      spec
        ? spec.trueLevels.kind === 'FIXED'
          ? spec.trueLevels.levelId
          : spec.trueLevels.fromLevelId
        : levels[0]?.id
    )
  )
  const [toLevelId, setToLevelId] = useState(
    String(
      spec?.trueLevels.kind === 'EVEN'
        ? spec.trueLevels.toLevelId
        : levels.at(-1)?.id
    )
  )
  const [competences, setCompetences] = useState<'SAME_LEVEL' | 'INDEPENDENT'>(
    spec?.competences ?? 'SAME_LEVEL'
  )
  const [cap, setCap] = useState(String(defaults.totalQuestionCap))
  const [minPerLeaf, setMinPerLeaf] = useState(
    String(defaults.minQuestionsPerLeaf)
  )
  const [z, setZ] = useState(
    String(
      CONFIDENCE_OPTIONS.find(
        (option) => Math.abs(option.z - defaults.classificationZ) < 0.01
      )?.z ?? defaults.classificationZ
    )
  )
  const [tolerance, setTolerance] = useState(
    String(defaults.classificationToleranceBands)
  )
  const locked = sameStudentsAs !== null

  const studentCount = toInt(students)
  const capValue = toInt(cap)
  const minValue = toInt(minPerLeaf)
  const order = (id: string) =>
    levels.find((level) => String(level.id) === id)?.order ?? 0
  const rangeInvalid = mode === 'EVEN' && order(fromLevelId) > order(toLevelId)
  const studentsInvalid =
    studentCount === null ||
    studentCount < 1 ||
    studentCount > workspace.maxStudents
  const capInvalid = capValue === null || capValue < 1 || capValue > 1000
  const tooLarge =
    !studentsInvalid &&
    !capInvalid &&
    studentCount! * capValue! > workspace.maxDecisions
  const minInvalid =
    minValue === null || (capValue !== null && minValue > capValue)
  const invalid =
    studentsInvalid || capInvalid || tooLarge || minInvalid || rangeInvalid

  const levelItems = levels.map((level) => ({
    value: String(level.id),
    label: level.label,
  }))
  const confidenceItems = [
    ...CONFIDENCE_OPTIONS.map(({ z, percent }) => ({
      value: String(z),
      label: `${percent}%`,
    })),
    ...(CONFIDENCE_OPTIONS.some(({ z: value }) => String(value) === z)
      ? []
      : [{ value: z, label: `z = ${z}` }]),
  ]

  return (
    <form
      className="space-y-4 rounded border border-gray-200 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (invalid) return
        onRun({
          students: studentCount!,
          noiseProbability: noise / 100,
          fromLevelId: Number(fromLevelId),
          toLevelId: Number(mode === 'FIXED' ? fromLevelId : toLevelId),
          competences,
          // A new seed means new random students.
          seed: spec?.seed ?? null,
          totalQuestionCap: capValue!,
          minQuestionsPerLeaf: minValue!,
          classificationZ: Number(z),
          classificationToleranceBands: Number(tolerance),
        })
      }}
      data-cy="adaptive-dry-run-form"
    >
      <h4 className="font-semibold">
        {t('manage.evaluation.adaptive.dryRuns.form.title')}
      </h4>

      {sameStudentsAs ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded border border-primary-40 bg-primary-20/40 px-3 py-2 text-sm"
          data-cy="adaptive-dry-run-same-students"
        >
          <span>
            {t('manage.evaluation.adaptive.dryRuns.form.sameStudents', {
              number: sameStudentsAs.number,
            })}
          </span>
          <Button
            basic
            onClick={onNewStudents}
            data={{ cy: 'adaptive-dry-run-new-students' }}
          >
            <Button.Icon icon={faXmark} />
            <Button.Label>
              {t('manage.evaluation.adaptive.dryRuns.form.newStudents')}
            </Button.Label>
          </Button>
        </div>
      ) : null}

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field
          label={t('manage.evaluation.adaptive.dryRuns.form.students')}
          htmlFor="adaptive-dry-run-students"
          hint={t('manage.evaluation.adaptive.dryRuns.form.studentsHint', {
            max: workspace.maxStudents,
          })}
          error={
            studentsInvalid
              ? t('manage.evaluation.adaptive.dryRuns.form.studentsInvalid', {
                  max: workspace.maxStudents,
                })
              : null
          }
        >
          <input
            id="adaptive-dry-run-students"
            type="number"
            min={1}
            max={workspace.maxStudents}
            value={students}
            onChange={(event) => setStudents(event.target.value)}
            disabled={locked}
            className={inputClass}
            data-cy="adaptive-dry-run-students"
          />
        </Field>
        <Field
          label={t('manage.evaluation.adaptive.dryRuns.form.trueLevels')}
          hint={t(
            mode === 'EVEN'
              ? 'manage.evaluation.adaptive.dryRuns.form.EVENHint'
              : 'manage.evaluation.adaptive.dryRuns.form.FIXEDHint'
          )}
          error={
            rangeInvalid
              ? t('manage.evaluation.adaptive.dryRuns.form.rangeInvalid')
              : null
          }
        >
          <Select
            value={mode}
            onChange={(value) => setMode(value as 'EVEN' | 'FIXED')}
            disabled={locked}
            items={[
              {
                value: 'EVEN',
                label: t('manage.evaluation.adaptive.dryRuns.form.EVEN'),
              },
              {
                value: 'FIXED',
                label: t('manage.evaluation.adaptive.dryRuns.form.FIXED'),
              },
            ]}
            className={{ trigger: 'w-full' }}
            data={{ cy: 'adaptive-dry-run-level-mode' }}
          />
          <div className="mt-2 flex items-center gap-2">
            <Select
              value={fromLevelId}
              onChange={setFromLevelId}
              disabled={locked}
              items={levelItems}
              className={{ root: 'flex-1', trigger: 'w-full' }}
              data={{ cy: 'adaptive-dry-run-from-level' }}
            />
            {mode === 'EVEN' ? (
              <>
                <span className="text-gray-500">–</span>
                <Select
                  value={toLevelId}
                  onChange={setToLevelId}
                  disabled={locked}
                  items={levelItems}
                  className={{ root: 'flex-1', trigger: 'w-full' }}
                  data={{ cy: 'adaptive-dry-run-to-level' }}
                />
              </>
            ) : null}
          </div>
        </Field>
        <Field
          label={t('manage.evaluation.adaptive.dryRuns.form.noise', { noise })}
          htmlFor="adaptive-dry-run-noise"
          hint={t('manage.evaluation.adaptive.dryRuns.form.noiseHint')}
        >
          <input
            id="adaptive-dry-run-noise"
            type="range"
            min={0}
            max={50}
            step={1}
            value={noise}
            onChange={(event) => setNoise(Number(event.target.value))}
            disabled={locked}
            className="h-9 w-full"
            data-cy="adaptive-dry-run-noise"
          />
        </Field>
        <Field
          label={t('manage.evaluation.adaptive.dryRuns.form.competences')}
          hint={t(
            competences === 'SAME_LEVEL'
              ? 'manage.evaluation.adaptive.dryRuns.form.SAME_LEVELHint'
              : 'manage.evaluation.adaptive.dryRuns.form.INDEPENDENTHint'
          )}
        >
          <Select
            value={competences}
            onChange={(value) =>
              setCompetences(value as 'SAME_LEVEL' | 'INDEPENDENT')
            }
            disabled={locked}
            items={(['SAME_LEVEL', 'INDEPENDENT'] as const).map((value) => ({
              value,
              label: t(`manage.evaluation.adaptive.dryRuns.form.${value}`),
            }))}
            className={{ trigger: 'w-full' }}
            data={{ cy: 'adaptive-dry-run-competences' }}
          />
        </Field>
      </div>

      <div>
        <h5 className="mb-2 text-sm font-semibold">
          {t('manage.evaluation.adaptive.dryRuns.form.stopSettings')}
        </h5>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field
            label={t(
              'manage.evaluation.adaptive.dryRuns.form.totalQuestionCap'
            )}
            htmlFor="adaptive-dry-run-cap"
            error={
              capInvalid
                ? t('manage.evaluation.adaptive.dryRuns.form.capInvalid')
                : tooLarge
                  ? t('manage.evaluation.adaptive.dryRuns.form.tooLarge', {
                      max: workspace.maxDecisions,
                    })
                  : null
            }
          >
            <input
              id="adaptive-dry-run-cap"
              type="number"
              min={1}
              max={1000}
              value={cap}
              onChange={(event) => setCap(event.target.value)}
              className={inputClass}
              data-cy="adaptive-dry-run-cap"
            />
          </Field>
          <Field label={t('manage.evaluation.adaptive.dryRuns.form.precision')}>
            <Select
              value={tolerance}
              onChange={setTolerance}
              items={(['0', '1', '2'] as const).map((value) => ({
                value,
                label: t(
                  `manage.evaluation.adaptive.dryRuns.form.precision${value}`
                ),
              }))}
              className={{ trigger: 'w-full' }}
              data={{ cy: 'adaptive-dry-run-precision' }}
            />
          </Field>
          <Field
            label={t('manage.evaluation.adaptive.dryRuns.form.confidence')}
          >
            <Select
              value={z}
              onChange={setZ}
              items={confidenceItems}
              className={{ trigger: 'w-full' }}
              data={{ cy: 'adaptive-dry-run-confidence' }}
            />
          </Field>
          <Field
            label={t(
              'manage.evaluation.adaptive.dryRuns.form.minQuestionsPerLeaf'
            )}
            htmlFor="adaptive-dry-run-min-per-leaf"
            error={
              minInvalid
                ? t('manage.evaluation.adaptive.dryRuns.form.minInvalid')
                : null
            }
          >
            <input
              id="adaptive-dry-run-min-per-leaf"
              type="number"
              min={0}
              value={minPerLeaf}
              onChange={(event) => setMinPerLeaf(event.target.value)}
              className={inputClass}
              data-cy="adaptive-dry-run-min-per-leaf"
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          primary
          disabled={invalid}
          loading={loading}
          data={{ cy: 'adaptive-dry-run-start' }}
        >
          <Button.Icon icon={faPlay} />
          <Button.Label>
            {t('manage.evaluation.adaptive.dryRuns.form.start')}
          </Button.Label>
        </Button>
      </div>
    </form>
  )
}

export default AdaptiveDryRunForm
