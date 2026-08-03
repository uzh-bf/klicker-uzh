import { faPlus, faUpload } from '@fortawesome/free-solid-svg-icons'
import {
  AdaptiveEmpiricalValidationStatus,
  AdaptiveItemCalibrationStatus,
  AdaptiveScaleLinkStatus,
  AdaptiveScaleVersionStatus,
  CompetenceTreeCalibrationDataFragment,
  CompetenceTreeDataFragment,
} from '@klicker-uzh/graphql/dist/ops'
import { Badge, Button, NumberField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import CalibrationStatus from './CalibrationStatus'

type TreeLevel = CompetenceTreeDataFragment['levels'][number]
type TreeAssignment = CompetenceTreeDataFragment['elementAssignments'][number]
type Scale = CompetenceTreeCalibrationDataFragment['scales'][number]

interface DraftLevel {
  sourceLevelId: number
  label: string
  lowerBound: string
  itemDifficultyPrior: string
}

export interface DraftScale {
  priorMean: string
  priorStandardDeviation: string
  gridMin: string
  gridMax: string
  gridStep: string
  levels: DraftLevel[]
}

export function ScaleReadiness({ scale }: { scale: Scale }) {
  const t = useTranslations()
  const approvedEvidence = scale.approvals.some(
    (approval) => approval.decision === AdaptiveScaleVersionStatus.Approved
  )
  const approvedValidation = scale.empiricalValidations.some(
    (validation) =>
      validation.status === AdaptiveEmpiricalValidationStatus.Approved
  )
  const approvedLink = scale.scaleLinks.some(
    (link) =>
      link.toScaleVersionId === scale.id &&
      link.status === AdaptiveScaleLinkStatus.Approved
  )
  const requiresLink = Boolean(scale.supersedesVersionId)

  return (
    <div className="mt-5 border-t border-slate-300 pt-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge className="rounded border border-slate-500 bg-white text-slate-800 hover:bg-white">
          {t(`manage.competenceTree.scale.status.${scale.status}`)}
        </Badge>
        <ReadinessFact
          ready={approvedEvidence}
          label={t('manage.competenceTree.scale.standardSettingStatus')}
        />
        <ReadinessFact
          ready={approvedValidation}
          label={t('manage.competenceTree.scale.empiricalValidationStatus')}
        />
        {requiresLink ? (
          <ReadinessFact
            ready={approvedLink}
            label={t('manage.competenceTree.scale.scaleLinkStatus')}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <CalibrationStatus
          status={AdaptiveItemCalibrationStatus.Calibrated}
          count={scale.calibrationCounts.calibrated}
        />
        <CalibrationStatus
          status={AdaptiveItemCalibrationStatus.Pilot}
          count={scale.calibrationCounts.pilot}
        />
        <CalibrationStatus
          status={AdaptiveItemCalibrationStatus.Provisional}
          count={scale.calibrationCounts.provisional}
        />
        <CalibrationStatus
          status={AdaptiveItemCalibrationStatus.Flagged}
          count={scale.calibrationCounts.flagged}
        />
        <CalibrationStatus
          status={AdaptiveItemCalibrationStatus.Retired}
          count={scale.calibrationCounts.retired}
        />
      </div>
    </div>
  )
}

export function ReadOnlyScaleReadiness({
  readiness,
}: {
  readiness: CompetenceTreeCalibrationDataFragment['readiness']
}) {
  const t = useTranslations()

  return (
    <section
      className="border-y border-slate-300 py-4"
      data-cy="adaptive-scale-readiness-summary"
    >
      <h3 className="font-semibold">
        {t('manage.competenceTree.scale.readinessSummary')}
      </h3>
      <p className="mt-1 text-sm text-slate-700">
        {t(`manage.competenceTree.scale.readinessStatus.${readiness.status}`)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <ReadinessMetric
          label={t('manage.competenceTree.scale.activeScaleVersion')}
          value={
            readiness.activeScaleVersion === null
              ? t('manage.competenceTree.scale.noActive')
              : String(readiness.activeScaleVersion)
          }
        />
        <ReadinessMetric
          label={t('manage.competenceTree.scale.enabledAssignments')}
          value={String(readiness.enabledAssignmentCount)}
        />
        <ReadinessMetric
          label={t('manage.competenceTree.scale.calibratedAssignments')}
          value={String(readiness.calibratedAssignmentCount)}
        />
        <ReadinessMetric
          label={t('manage.competenceTree.scale.blockingAssignments')}
          value={String(readiness.blockingAssignmentCount)}
        />
      </dl>
    </section>
  )
}

function ReadinessMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function ReadinessFact({ ready, label }: { ready: boolean; label: string }) {
  const t = useTranslations()
  return (
    <span
      className={
        ready
          ? 'border-l-2 border-green-700 pl-2 text-sm text-green-900'
          : 'border-l-2 border-amber-700 pl-2 text-sm text-amber-900'
      }
    >
      {label}: {t(ready ? 'shared.generic.yes' : 'shared.generic.no')}
    </span>
  )
}

export function DraftScaleForm({
  draft,
  onChange,
  onCancel,
  onCreate,
  loading,
}: {
  draft: DraftScale
  onChange: (draft: DraftScale) => void
  onCancel: () => void
  onCreate: () => void
  loading: boolean
}) {
  const t = useTranslations()

  return (
    <div
      className="mt-5 border-t border-slate-300 pt-5"
      data-cy="adaptive-scale-draft-form"
    >
      <h3 className="mb-1 font-semibold">
        {t('manage.competenceTree.scale.draftTitle')}
      </h3>
      <p className="mb-4 text-sm text-slate-600">
        {t('manage.competenceTree.scale.draftDescription')}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <ScaleNumberField
          label={t('manage.competenceTree.scale.priorMean')}
          value={draft.priorMean}
          onChange={(priorMean) => onChange({ ...draft, priorMean })}
          dataCy="adaptive-scale-prior-mean"
        />
        <ScaleNumberField
          label={t('manage.competenceTree.scale.priorStandardDeviation')}
          value={draft.priorStandardDeviation}
          onChange={(priorStandardDeviation) =>
            onChange({ ...draft, priorStandardDeviation })
          }
          dataCy="adaptive-scale-prior-sd"
          min={0.01}
        />
        <ScaleNumberField
          label={t('manage.competenceTree.scale.rangeStart')}
          value={draft.gridMin}
          onChange={(gridMin) => onChange({ ...draft, gridMin })}
          dataCy="adaptive-scale-range-start"
        />
        <ScaleNumberField
          label={t('manage.competenceTree.scale.rangeEnd')}
          value={draft.gridMax}
          onChange={(gridMax) => onChange({ ...draft, gridMax })}
          dataCy="adaptive-scale-range-end"
        />
        <ScaleNumberField
          label={t('manage.competenceTree.scale.gridStep')}
          value={draft.gridStep}
          onChange={(gridStep) => onChange({ ...draft, gridStep })}
          dataCy="adaptive-scale-grid-step"
          min={0.01}
        />
      </div>
      <div className="mt-4 overflow-x-auto border-y border-slate-200">
        <table className="w-full min-w-[38rem] text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-3 py-2">{t('manage.competenceTree.level')}</th>
              <th className="px-3 py-2">
                {t('manage.competenceTree.scale.lowerBound')}
              </th>
              <th className="px-3 py-2">
                {t('manage.competenceTree.expectedDifficulty')}
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.levels.map((level, index) => (
              <tr
                key={level.sourceLevelId}
                className="border-t border-slate-200"
              >
                <th className="px-3 py-2 font-medium">{level.label}</th>
                <td className="px-3 py-2">
                  {index === 0 ? (
                    <span className="text-slate-500">
                      {t('manage.competenceTree.scale.openLowerBound')}
                    </span>
                  ) : (
                    <NumberField
                      value={level.lowerBound}
                      onChange={(lowerBound) =>
                        onChange({
                          ...draft,
                          levels: draft.levels.map((candidate) =>
                            candidate.sourceLevelId === level.sourceLevelId
                              ? { ...candidate, lowerBound }
                              : candidate
                          ),
                        })
                      }
                      precision={2}
                      data={{ cy: `adaptive-scale-cut-${level.sourceLevelId}` }}
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  <NumberField
                    value={level.itemDifficultyPrior}
                    onChange={(itemDifficultyPrior) =>
                      onChange({
                        ...draft,
                        levels: draft.levels.map((candidate) =>
                          candidate.sourceLevelId === level.sourceLevelId
                            ? { ...candidate, itemDifficultyPrior }
                            : candidate
                        ),
                      })
                    }
                    precision={2}
                    data={{
                      cy: `adaptive-scale-item-prior-${level.sourceLevelId}`,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onCancel} data={{ cy: 'adaptive-scale-draft-cancel' }}>
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
        <Button
          primary
          onClick={onCreate}
          loading={loading}
          data={{ cy: 'adaptive-scale-draft-save' }}
        >
          <Button.Icon icon={faPlus} loading={loading} />
          <Button.Label>
            {t('manage.competenceTree.scale.createDraft')}
          </Button.Label>
        </Button>
      </div>
    </div>
  )
}

function ScaleNumberField({
  label,
  value,
  onChange,
  dataCy,
  min,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  dataCy: string
  min?: number
}) {
  return (
    <NumberField
      label={label}
      value={value}
      onChange={onChange}
      min={min}
      precision={2}
      data={{ cy: dataCy }}
    />
  )
}

export function ArtifactAction({
  title,
  description,
  inputRef,
  inputCy,
  buttonCy,
  buttonLabel,
  loading,
  disabled,
  onFile,
}: {
  title: string
  description: string
  inputRef: React.RefObject<HTMLInputElement | null>
  inputCy: string
  buttonCy: string
  buttonLabel: string
  loading: boolean
  disabled: boolean
  onFile: (file: File | undefined) => void
}) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-3 text-sm text-slate-600">{description}</p>
      <label className="sr-only" htmlFor={inputCy}>
        {title}
      </label>
      <input
        id={inputCy}
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        data-cy={inputCy}
        onChange={(event) => {
          onFile(event.currentTarget.files?.[0])
          event.currentTarget.value = ''
        }}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        loading={loading}
        disabled={disabled}
        data={{ cy: buttonCy }}
      >
        <Button.Icon icon={faUpload} loading={loading} />
        <Button.Label>{buttonLabel}</Button.Label>
      </Button>
    </div>
  )
}

export function createDraftScale(
  activeScale: Scale | null,
  treeLevels: TreeLevel[]
): DraftScale {
  const activeLevelBySourceId = new Map(
    activeScale?.levels.flatMap((level) =>
      typeof level.sourceLevelId === 'number'
        ? ([[level.sourceLevelId, level]] as const)
        : []
    ) ?? []
  )

  return {
    priorMean: String(activeScale?.priorMean ?? 0),
    priorStandardDeviation: String(activeScale?.priorStandardDeviation ?? 1),
    gridMin: String(activeScale?.gridMin ?? -6),
    gridMax: String(activeScale?.gridMax ?? 6),
    gridStep: String(activeScale?.gridStep ?? 0.1),
    levels: [...treeLevels]
      .sort((left, right) => left.order - right.order)
      .map((level, index) => {
        const activeLevel = activeLevelBySourceId.get(level.id)
        return {
          sourceLevelId: level.id,
          label: level.label,
          lowerBound:
            index === 0
              ? ''
              : String(activeLevel?.lowerBound ?? level.lowerBound ?? ''),
          itemDifficultyPrior: String(
            activeLevel?.itemDifficultyPrior ?? level.theta
          ),
        }
      }),
  }
}

export function parseDraftScale(draft: DraftScale) {
  const number = (value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) throw new Error('INVALID_NUMBER')
    return parsed
  }

  return {
    priorMean: number(draft.priorMean),
    priorStandardDeviation: number(draft.priorStandardDeviation),
    gridMin: number(draft.gridMin),
    gridMax: number(draft.gridMax),
    gridStep: number(draft.gridStep),
    levels: draft.levels.map((level, index) => ({
      sourceLevelId: level.sourceLevelId,
      lowerBound: index === 0 ? null : number(level.lowerBound),
      itemDifficultyPrior: number(level.itemDifficultyPrior),
    })),
  }
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
