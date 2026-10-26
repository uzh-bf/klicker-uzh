import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { Button, NumberField, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  CONFIDENCE_OPTIONS,
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

// New dry run: simulated students and stop settings for this run only. The
// stop settings start from the published quiz; the quiz is never changed.
function AdaptiveDryRunForm({
  workspace,
  loading,
  onRun,
}: {
  workspace: DryRunWorkspace
  loading: boolean
  onRun: (values: DryRunFormValues) => void
}) {
  const t = useTranslations()
  const defaults = workspace.defaults as DryRunSettings
  const levels = workspace.levels
  const [students, setStudents] = useState('100')
  const [noise, setNoise] = useState(2)
  const [mode, setMode] = useState<'EVEN' | 'FIXED'>('EVEN')
  const [fromLevelId, setFromLevelId] = useState(String(levels[0]?.id))
  const [toLevelId, setToLevelId] = useState(String(levels.at(-1)?.id))
  const [competences, setCompetences] = useState<'SAME_LEVEL' | 'INDEPENDENT'>(
    'SAME_LEVEL'
  )
  const [seed, setSeed] = useState('')
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
  const seedInvalid = seed.trim() !== '' && !/^[a-f0-9]{64}$/.test(seed.trim())
  const invalid =
    studentsInvalid ||
    capInvalid ||
    tooLarge ||
    minInvalid ||
    rangeInvalid ||
    seedInvalid

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
          seed: seed.trim() === '' ? null : seed.trim(),
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NumberField
          id="adaptive-dry-run-students"
          label={t('manage.evaluation.adaptive.dryRuns.form.students')}
          tooltip={t('manage.evaluation.adaptive.dryRuns.form.studentsHint', {
            max: workspace.maxStudents,
          })}
          value={students}
          onChange={setStudents}
          precision={0}
          min={1}
          max={workspace.maxStudents}
          error={
            studentsInvalid
              ? t('manage.evaluation.adaptive.dryRuns.form.studentsInvalid', {
                  max: workspace.maxStudents,
                })
              : undefined
          }
          isTouched
          data={{ cy: 'adaptive-dry-run-students' }}
          className={{ input: 'h-9 text-sm' }}
        />
        <div className="text-sm">
          <span className="mb-1 block font-bold text-gray-700">
            {t('manage.evaluation.adaptive.dryRuns.form.trueLevels')}
          </span>
          <Select
            value={mode}
            onChange={(value) => setMode(value as 'EVEN' | 'FIXED')}
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
            data={{ cy: 'adaptive-dry-run-level-mode' }}
          />
          <div className="mt-2 flex items-center gap-2">
            <Select
              value={fromLevelId}
              onChange={setFromLevelId}
              items={levelItems}
              data={{ cy: 'adaptive-dry-run-from-level' }}
            />
            {mode === 'EVEN' ? (
              <>
                <span className="text-gray-500">–</span>
                <Select
                  value={toLevelId}
                  onChange={setToLevelId}
                  items={levelItems}
                  data={{ cy: 'adaptive-dry-run-to-level' }}
                />
              </>
            ) : null}
          </div>
          {rangeInvalid ? (
            <p className="mt-1 text-xs text-red-600">
              {t('manage.evaluation.adaptive.dryRuns.form.rangeInvalid')}
            </p>
          ) : null}
        </div>
        <div className="text-sm">
          <label
            htmlFor="adaptive-dry-run-noise"
            className="mb-1 block font-bold text-gray-700"
          >
            {t('manage.evaluation.adaptive.dryRuns.form.noise', { noise })}
          </label>
          <input
            id="adaptive-dry-run-noise"
            type="range"
            min={0}
            max={50}
            step={1}
            value={noise}
            onChange={(event) => setNoise(Number(event.target.value))}
            className="w-full accent-primary-100"
            data-cy="adaptive-dry-run-noise"
          />
          <p className="text-xs text-gray-600">
            {t('manage.evaluation.adaptive.dryRuns.form.noiseHint')}
          </p>
        </div>
        <div className="text-sm">
          <span className="mb-1 block font-bold text-gray-700">
            {t('manage.evaluation.adaptive.dryRuns.form.competences')}
          </span>
          <Select
            value={competences}
            onChange={(value) =>
              setCompetences(value as 'SAME_LEVEL' | 'INDEPENDENT')
            }
            items={(['SAME_LEVEL', 'INDEPENDENT'] as const).map((value) => ({
              value,
              label: t(`manage.evaluation.adaptive.dryRuns.form.${value}`),
            }))}
            data={{ cy: 'adaptive-dry-run-competences' }}
          />
        </div>
      </div>

      <div>
        <h5 className="mb-2 text-sm font-semibold">
          {t('manage.evaluation.adaptive.dryRuns.form.stopSettings')}
        </h5>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NumberField
            id="adaptive-dry-run-cap"
            label={t(
              'manage.evaluation.adaptive.dryRuns.form.totalQuestionCap'
            )}
            value={cap}
            onChange={setCap}
            precision={0}
            min={1}
            max={1000}
            error={
              capInvalid
                ? t('manage.evaluation.adaptive.dryRuns.form.capInvalid')
                : tooLarge
                  ? t('manage.evaluation.adaptive.dryRuns.form.tooLarge', {
                      max: workspace.maxDecisions,
                    })
                  : undefined
            }
            isTouched
            data={{ cy: 'adaptive-dry-run-cap' }}
            className={{ input: 'h-9 text-sm' }}
          />
          <div className="text-sm">
            <span className="mb-1 block font-bold text-gray-700">
              {t('manage.evaluation.adaptive.dryRuns.form.precision')}
            </span>
            <Select
              value={tolerance}
              onChange={setTolerance}
              items={(['0', '1', '2'] as const).map((value) => ({
                value,
                label: t(
                  `manage.evaluation.adaptive.dryRuns.form.precision${value}`
                ),
              }))}
              data={{ cy: 'adaptive-dry-run-precision' }}
            />
          </div>
          <div className="text-sm">
            <span className="mb-1 block font-bold text-gray-700">
              {t('manage.evaluation.adaptive.dryRuns.form.confidence')}
            </span>
            <Select
              value={z}
              onChange={setZ}
              items={confidenceItems}
              data={{ cy: 'adaptive-dry-run-confidence' }}
            />
          </div>
          <NumberField
            id="adaptive-dry-run-min-per-leaf"
            label={t(
              'manage.evaluation.adaptive.dryRuns.form.minQuestionsPerLeaf'
            )}
            value={minPerLeaf}
            onChange={setMinPerLeaf}
            precision={0}
            min={0}
            error={
              minInvalid
                ? t('manage.evaluation.adaptive.dryRuns.form.minInvalid')
                : undefined
            }
            isTouched
            data={{ cy: 'adaptive-dry-run-min-per-leaf' }}
            className={{ input: 'h-9 text-sm' }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="text-sm">
          <label
            htmlFor="adaptive-dry-run-seed"
            className="mb-1 block font-bold text-gray-700"
          >
            {t('manage.evaluation.adaptive.dryRuns.form.seed')}
          </label>
          <input
            id="adaptive-dry-run-seed"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            placeholder={t('manage.evaluation.adaptive.dryRuns.form.seedHint')}
            className="h-9 w-[34rem] max-w-full rounded border border-gray-300 px-2 font-mono text-xs"
            data-cy="adaptive-dry-run-seed"
          />
          {seedInvalid ? (
            <p className="mt-1 text-xs text-red-600">
              {t('manage.evaluation.adaptive.dryRuns.form.seedInvalid')}
            </p>
          ) : null}
        </div>
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
