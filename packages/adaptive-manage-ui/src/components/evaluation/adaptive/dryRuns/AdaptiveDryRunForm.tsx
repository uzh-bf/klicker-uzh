import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { Button, Label, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import LevelReachedFromInput from '../../../activities/creation/practiceQuiz/LevelReachedFromInput'
import RequiredCertaintySelect from '../../../activities/creation/practiceQuiz/RequiredCertaintySelect'
import type {
  DryRunAnswerModel,
  DryRunSettings,
  DryRunWorkspace,
} from './adaptiveDryRunTypes'

export type DryRunFormValues = {
  students: number
  noiseProbability: number
  fromLevelId: number
  toLevelId: number
  competences: 'SAME_LEVEL' | 'INDEPENDENT'
  answerModel: DryRunAnswerModel
  seed: string | null
  totalQuestionCap: number
  minQuestionsPerLeaf: number
  classificationZ: number
  classificationToleranceBands: number
  levelReachedFrom: number
}

const F = 'manage.evaluation.adaptive.dryRuns.form'

const toInt = (value: string) =>
  /^\d+$/.test(value.trim()) ? Number(value.trim()) : null

const inputClass =
  'h-9 w-full rounded border border-gray-300 px-2 text-sm disabled:bg-gray-100 disabled:text-gray-500'

// One label style for every control, so the fields of a row line up. The
// explanation sits behind the info symbol; only errors show below.
function Field({
  label,
  htmlFor,
  tooltip,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  tooltip?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="text-sm">
      <Label
        label={label}
        forId={htmlFor}
        tooltip={tooltip}
        showTooltipSymbol={Boolean(tooltip)}
        tooltipSymbolSize="sm"
        className={{
          root: 'mb-1 font-semibold text-gray-700',
          tooltip: 'max-w-80 text-sm font-normal',
        }}
      />
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

export const DRY_RUN_SEED_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

// New dry run: simulated students and stop settings for this run only. The
// stop settings start from the published quiz; the quiz is never changed.
// The seed is held by the parent, so a run's seed can be put back in here:
// the same seed with the same student settings gives the same students.
function AdaptiveDryRunForm({
  workspace,
  loading,
  onRun,
  seed,
  onSeedChange,
}: {
  workspace: DryRunWorkspace
  loading: boolean
  onRun: (values: DryRunFormValues) => void
  seed: string
  onSeedChange: (seed: string) => void
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
    'INDEPENDENT'
  )
  const [answerModel, setAnswerModel] = useState<DryRunAnswerModel>('IDEAL')
  const [cap, setCap] = useState(String(defaults.totalQuestionCap))
  const [minPerLeaf, setMinPerLeaf] = useState(
    String(defaults.minQuestionsPerLeaf)
  )
  const [tolerance, setTolerance] = useState(
    String(defaults.classificationToleranceBands)
  )
  const initialReachedFrom = String(defaults.levelReachedFrom ?? 0)
  // Null while the field holds an invalid percentage.
  const [reachedFrom, setReachedFrom] = useState<string | null>(
    initialReachedFrom
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
  const seedInvalid =
    seed.trim() !== '' && !DRY_RUN_SEED_PATTERN.test(seed.trim())
  const invalid =
    studentsInvalid ||
    capInvalid ||
    tooLarge ||
    minInvalid ||
    rangeInvalid ||
    seedInvalid ||
    reachedFrom === null

  const levelItems = levels.map((level) => ({
    value: String(level.id),
    label: level.label,
  }))
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
          answerModel,
          // Without a seed the server picks a random one.
          seed: seed.trim() || null,
          totalQuestionCap: capValue!,
          minQuestionsPerLeaf: minValue!,
          // The quiz's own confidence; authors cannot change it.
          classificationZ: defaults.classificationZ,
          classificationToleranceBands: Number(tolerance),
          levelReachedFrom: Number(reachedFrom),
        })
      }}
      data-cy="adaptive-dry-run-form"
    >
      <h4 className="font-semibold">{t(`${F}.title`)}</h4>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t(`${F}.studentsGroup`)}
        </legend>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field
            label={t(`${F}.students`)}
            htmlFor="adaptive-dry-run-students"
            tooltip={t(`${F}.studentsHint`, { max: workspace.maxStudents })}
            error={
              studentsInvalid
                ? t(`${F}.studentsInvalid`, { max: workspace.maxStudents })
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
              className={inputClass}
              data-cy="adaptive-dry-run-students"
            />
          </Field>
          <Field
            label={t(`${F}.trueLevels`)}
            tooltip={t(`${F}.trueLevelsHint`)}
            error={rangeInvalid ? t(`${F}.rangeInvalid`) : null}
          >
            <Select
              value={mode}
              onChange={(value) => setMode(value as 'EVEN' | 'FIXED')}
              items={(['EVEN', 'FIXED'] as const).map((value) => ({
                value,
                label: t(`${F}.${value}`),
              }))}
              className={{ trigger: 'w-full' }}
              data={{ cy: 'adaptive-dry-run-level-mode' }}
            />
            <div className="mt-2 flex items-center gap-2">
              <Select
                value={fromLevelId}
                onChange={setFromLevelId}
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
                    items={levelItems}
                    className={{ root: 'flex-1', trigger: 'w-full' }}
                    data={{ cy: 'adaptive-dry-run-to-level' }}
                  />
                </>
              ) : null}
            </div>
          </Field>
          <Field
            label={t(`${F}.competences`)}
            tooltip={t(`${F}.competencesHint`)}
          >
            <Select
              value={competences}
              onChange={(value) =>
                setCompetences(value as 'SAME_LEVEL' | 'INDEPENDENT')
              }
              items={(['SAME_LEVEL', 'INDEPENDENT'] as const).map((value) => ({
                value,
                label: t(`${F}.${value}`),
              }))}
              className={{ trigger: 'w-full' }}
              data={{ cy: 'adaptive-dry-run-competences' }}
            />
          </Field>
          <Field
            label={t(`${F}.answerModel`)}
            tooltip={t(`${F}.answerModelHint`)}
          >
            <Select
              value={answerModel}
              onChange={(value) => setAnswerModel(value as DryRunAnswerModel)}
              items={(['IDEAL', 'REALISTIC'] as const).map((value) => ({
                value,
                label: t(`${F}.answerModel${value}`),
              }))}
              className={{ trigger: 'w-full' }}
              data={{ cy: 'adaptive-dry-run-answer-model' }}
            />
            {answerModel === 'IDEAL' ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-700">
                <label
                  htmlFor="adaptive-dry-run-noise"
                  className="w-20 shrink-0"
                  title={t(`${F}.noiseHint`)}
                >
                  {t(`${F}.noise`, { noise })}
                </label>
                <input
                  id="adaptive-dry-run-noise"
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={noise}
                  onChange={(event) => setNoise(Number(event.target.value))}
                  className="h-6 w-full"
                  data-cy="adaptive-dry-run-noise"
                />
              </div>
            ) : null}
          </Field>
          <Field
            label={t(`${F}.seed`)}
            htmlFor="adaptive-dry-run-seed"
            tooltip={t(`${F}.seedHint`)}
            error={seedInvalid ? t(`${F}.seedInvalid`) : null}
          >
            <input
              id="adaptive-dry-run-seed"
              type="text"
              value={seed}
              onChange={(event) => onSeedChange(event.target.value)}
              placeholder={t(`${F}.seedPlaceholder`)}
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} font-mono`}
              data-cy="adaptive-dry-run-seed"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t(`${F}.stopSettings`)}
        </legend>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field
            label={t(`${F}.totalQuestionCap`)}
            htmlFor="adaptive-dry-run-cap"
            tooltip={t(`${F}.totalQuestionCapHint`)}
            error={
              capInvalid
                ? t(`${F}.capInvalid`)
                : tooLarge
                  ? t(`${F}.tooLarge`, { max: workspace.maxDecisions })
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
          <Field
            label={t('manage.activityWizard.adaptive.stopping.certainty')}
            tooltip={t('manage.activityWizard.adaptive.stopping.certaintyHint')}
          >
            <RequiredCertaintySelect
              value={tolerance}
              onChange={setTolerance}
              cy="adaptive-dry-run-precision"
            />
          </Field>
          <Field
            label={t(`${F}.reachedFrom`)}
            htmlFor="adaptive-dry-run-reached-from"
            tooltip={t(`${F}.reachedFromHint`)}
          >
            <LevelReachedFromInput
              id="adaptive-dry-run-reached-from"
              value={initialReachedFrom}
              onChange={setReachedFrom}
              cy="adaptive-dry-run-reached-from"
            />
          </Field>
          <Field
            label={t(`${F}.minQuestionsPerLeaf`)}
            htmlFor="adaptive-dry-run-min-per-leaf"
            tooltip={t(`${F}.minQuestionsPerLeafHint`)}
            error={minInvalid ? t(`${F}.minInvalid`) : null}
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
      </fieldset>

      <div className="flex justify-end">
        <Button
          type="submit"
          primary
          disabled={invalid}
          loading={loading}
          data={{ cy: 'adaptive-dry-run-start' }}
        >
          <Button.Icon icon={faPlay} />
          <Button.Label>{t(`${F}.start`)}</Button.Label>
        </Button>
      </div>
    </form>
  )
}

export default AdaptiveDryRunForm
