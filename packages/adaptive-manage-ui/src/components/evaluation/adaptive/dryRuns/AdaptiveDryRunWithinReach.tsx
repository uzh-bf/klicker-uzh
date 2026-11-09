import { useTranslations } from 'next-intl'
import {
  type DryRunMasterySettings,
  summarizeDryRunMastery,
} from './adaptiveDryRunHints'
import type { DryRunStudent, DryRunWorkspace } from './adaptiveDryRunTypes'
import { percent } from './adaptiveDryRunTypes'

const KEY = 'manage.evaluation.adaptive.dryRuns.mastery'

// Mastery statement on top of the reported level (client reading): a level
// counts as mastered when the ability is likely (`probability`) at or beyond
// `masteryPoint` of its band. Measured against the simulated true level,
// which a student has mastered while the next level is not yet mastered.
function AdaptiveDryRunWithinReach({
  students,
  workspace,
  settings,
  onSettingsChange,
}: {
  students: DryRunStudent[] | null
  workspace: DryRunWorkspace
  settings: DryRunMasterySettings
  onSettingsChange: (settings: DryRunMasterySettings) => void
}) {
  const t = useTranslations()
  const summary = students
    ? summarizeDryRunMastery(students, workspace, settings)
    : null
  const mainTiles = summary
    ? ([
        ['mainMastered', summary.main.masteredShare],
        ['mainMasteredRight', summary.main.masteredRightShare],
        ['mainHighestExact', summary.main.highestExactShare],
      ] as const)
    : []
  const tiles = summary
    ? ([
        ['mastered', summary.masteredShare],
        ['masteredRight', summary.masteredRightShare],
        ['highestExact', summary.highestExactShare],
        ['highestWithinOne', summary.highestWithinOneShare],
      ] as const)
    : []
  const slider = (
    key: keyof DryRunMasterySettings,
    min: number,
    max: number
  ) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-56 font-semibold text-gray-700">
        {t(`${KEY}.${key}`, { value: Math.round(settings[key] * 100) })}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={5}
        value={Math.round(settings[key] * 100)}
        onChange={(event) =>
          onSettingsChange({
            ...settings,
            [key]: Number(event.target.value) / 100,
          })
        }
        className="w-40"
        data-cy={`adaptive-dry-run-mastery-${key}`}
      />
    </label>
  )

  return (
    <div
      className="rounded border border-gray-200 p-3"
      data-cy="adaptive-dry-run-mastery"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="text-sm font-semibold">{t(`${KEY}.title`)}</h5>
          <p className="max-w-3xl text-xs text-gray-600">{t(`${KEY}.hint`)}</p>
        </div>
        <div className="space-y-1">
          {slider('masteryPoint', 50, 95)}
          {slider('probability', 50, 95)}
        </div>
      </div>
      {summary ? (
        <h6 className="mt-3 text-xs font-semibold text-gray-700">
          {t(`${KEY}.sublevels`)}
        </h6>
      ) : null}
      {summary ? (
        <div className="mt-1 grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2">
          {tiles.map(([key, value]) => (
            <div
              key={key}
              className="rounded border border-gray-200 px-3 py-2"
              data-cy={`adaptive-dry-run-mastery-${key}-tile`}
            >
              <div className="text-xs text-gray-600">
                {t(`${KEY}.tiles.${key}`)}
              </div>
              <div className="text-xl font-semibold tabular-nums">
                {value === null ? '–' : percent(value)}
              </div>
              <div className="text-xs text-gray-500">
                {t(`${KEY}.tileHints.${key}`)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500">{t(`${KEY}.loading`)}</p>
      )}
      {summary ? (
        <>
          <h6 className="mt-3 text-xs font-semibold text-gray-700">
            {t(`${KEY}.mainLevels`)}
          </h6>
          <div className="mt-1 grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2">
            {mainTiles.map(([key, value]) => (
              <div
                key={key}
                className="rounded border border-gray-200 px-3 py-2"
                data-cy={`adaptive-dry-run-mastery-${key}-tile`}
              >
                <div className="text-xs text-gray-600">
                  {t(`${KEY}.tiles.${key}`)}
                </div>
                <div className="text-xl font-semibold tabular-nums">
                  {value === null ? '–' : percent(value)}
                </div>
                <div className="text-xs text-gray-500">
                  {t(`${KEY}.tileHints.${key}`)}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export default AdaptiveDryRunWithinReach
