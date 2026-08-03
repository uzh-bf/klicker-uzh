import {
  AdaptivePracticeQuizSetupPreviewQuery,
  CompetenceTreeQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Checkbox, Select, TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useMemo, useState } from 'react'
import Pagination from '../../../common/Pagination'
import { AdaptivePracticeQuizConfigFormValues } from '../WizardLayout'
import { AdaptiveCoverageReadinessData } from './AdaptiveReadinessPanel'

const DEFAULT_PAGE_SIZE = 20

type CompetenceTreeData = NonNullable<CompetenceTreeQuery['competenceTree']>
type AdaptiveAssignmentData = CompetenceTreeData['elementAssignments'][number]
type AdaptiveAssignmentLevelData = CompetenceTreeData['levels'][number]
type AdaptiveAssignmentNodeData = CompetenceTreeData['nodes'][number]
type AdaptiveCoverageData = CompetenceTreeData['levelCoverages'][number]
type AdaptiveEffectiveAssignmentData = NonNullable<
  AdaptivePracticeQuizSetupPreviewQuery['adaptivePracticeQuizSetupPreview']
>['assignments'][number]

type AssignmentStateFilter = 'ALL' | 'ENABLED' | 'DISABLED'

function AdaptiveAssignmentPreview({
  assignments,
  levels,
  nodes,
  coverages,
  coverageReadiness,
  effectiveAssignments,
  effectiveStateStale = false,
  config,
  onChange,
}: {
  assignments: AdaptiveAssignmentData[]
  levels: AdaptiveAssignmentLevelData[]
  nodes: AdaptiveAssignmentNodeData[]
  coverages: AdaptiveCoverageData[]
  coverageReadiness?: AdaptiveCoverageReadinessData[]
  effectiveAssignments?: AdaptiveEffectiveAssignmentData[]
  effectiveStateStale?: boolean
  config: AdaptivePracticeQuizConfigFormValues
  onChange: (config: AdaptivePracticeQuizConfigFormValues) => void
}) {
  const t = useTranslations()
  const [search, setSearch] = useState('')
  const [leafFilter, setLeafFilter] = useState('ALL')
  const [levelFilter, setLevelFilter] = useState('ALL')
  const [stateFilter, setStateFilter] = useState<AssignmentStateFilter>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const searchId = useId()
  const leafFilterId = useId()
  const levelFilterId = useId()
  const stateFilterId = useId()
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  )
  const levelById = useMemo(
    () => new Map(levels.map((level) => [level.id, level])),
    [levels]
  )
  const overrideByAssignment = useMemo(
    () =>
      new Map(
        config.elementOverrides.map((value) => [value.assignmentId, value])
      ),
    [config.elementOverrides]
  )
  const effectiveByAssignment = useMemo(
    () =>
      new Map(
        effectiveAssignments?.map((assignment) => [
          assignment.id,
          assignment,
        ]) ?? []
      ),
    [effectiveAssignments]
  )
  const nodeOverrideById = useMemo(
    () => new Map(config.nodeOverrides.map((value) => [value.nodeId, value])),
    [config.nodeOverrides]
  )
  const coverageByCell = useMemo(
    () =>
      new Map(
        coverages.map((coverage) => [
          `${coverage.leafNodeId}:${coverage.levelId}`,
          coverage,
        ])
      ),
    [coverages]
  )
  const leafIds = useMemo(
    () => Array.from(new Set(coverages.map((coverage) => coverage.leafNodeId))),
    [coverages]
  )
  const sortedLevels = useMemo(
    () => [...levels].sort((a, b) => a.order - b.order || a.id - b.id),
    [levels]
  )
  const filteredAssignments = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return assignments.filter((assignment) => {
      const override = overrideByAssignment.get(assignment.id)
      const directEnabled = override?.enabled ?? true
      return (
        (!normalizedSearch ||
          assignment.elementName
            .toLocaleLowerCase()
            .includes(normalizedSearch) ||
          String(assignment.elementId).includes(normalizedSearch)) &&
        (leafFilter === 'ALL' ||
          assignment.leafNodeId === Number(leafFilter)) &&
        (levelFilter === 'ALL' || assignment.levelId === Number(levelFilter)) &&
        (stateFilter === 'ALL' ||
          (stateFilter === 'ENABLED' ? directEnabled : !directEnabled))
      )
    })
  }, [
    assignments,
    leafFilter,
    levelFilter,
    overrideByAssignment,
    search,
    stateFilter,
  ])
  const totalPages = Math.max(
    1,
    Math.ceil(filteredAssignments.length / pageSize)
  )
  const visibleAssignments = filteredAssignments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [search, leafFilter, levelFilter, stateFilter])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const updateAssignment = (
    assignment: AdaptiveAssignmentData,
    patch: Partial<{ enabled: boolean }>
  ) => {
    const current = overrideByAssignment.get(assignment.id) ?? {
      assignmentId: assignment.id,
      enabled: true,
      discrimination: '',
    }
    onChange({
      ...config,
      elementOverrides: [
        ...config.elementOverrides.filter(
          (value) => value.assignmentId !== assignment.id
        ),
        { ...current, ...patch },
      ],
    })
  }

  return (
    <section
      className="min-w-0 max-w-full"
      data-cy="adaptive-assignment-preview"
    >
      <div className="mb-2 font-bold">
        {t('manage.activityWizard.adaptive.assignments.title')}
      </div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0">
          <label htmlFor={searchId} className="sr-only">
            {t('manage.activityWizard.adaptive.assignments.searchPlaceholder')}
          </label>
          <TextField
            id={searchId}
            value={search}
            onChange={setSearch}
            placeholder={t(
              'manage.activityWizard.adaptive.assignments.searchPlaceholder'
            )}
            autoComplete="off"
            data={{ cy: 'adaptive-assignment-search' }}
            className={{ field: 'min-w-0', input: 'h-9' }}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={leafFilterId} className="sr-only">
            {t('manage.activityWizard.adaptive.assignments.leaf')}
          </label>
          <Select
            id={leafFilterId}
            value={leafFilter}
            onChange={setLeafFilter}
            items={[
              {
                value: 'ALL',
                label: t(
                  'manage.activityWizard.adaptive.assignments.allLeaves'
                ),
              },
              ...leafIds.map((leafId) => ({
                value: String(leafId),
                label: getNodeBreadcrumb(leafId, nodeById),
              })),
            ]}
            data={{ cy: 'adaptive-assignment-leaf-filter' }}
            className={{ root: 'w-full min-w-0', trigger: 'w-full' }}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={levelFilterId} className="sr-only">
            {t('manage.activityWizard.adaptive.assignments.level')}
          </label>
          <Select
            id={levelFilterId}
            value={levelFilter}
            onChange={setLevelFilter}
            items={[
              {
                value: 'ALL',
                label: t(
                  'manage.activityWizard.adaptive.assignments.allLevels'
                ),
              },
              ...sortedLevels.map((level) => ({
                value: String(level.id),
                label: level.label,
              })),
            ]}
            data={{ cy: 'adaptive-assignment-level-filter' }}
            className={{ root: 'w-full min-w-0', trigger: 'w-full' }}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={stateFilterId} className="sr-only">
            {t('shared.generic.status')}
          </label>
          <Select
            id={stateFilterId}
            value={stateFilter}
            onChange={(value) => setStateFilter(value as AssignmentStateFilter)}
            items={(['ALL', 'ENABLED', 'DISABLED'] as const).map((value) => ({
              value,
              label: t(
                `manage.activityWizard.adaptive.assignments.state.${value}`
              ),
            }))}
            data={{ cy: 'adaptive-assignment-state-filter' }}
            className={{ root: 'w-full min-w-0', trigger: 'w-full' }}
          />
        </div>
      </div>

      <div className="border-uzh-grey-80 mt-2 max-h-72 w-full min-w-0 max-w-full overflow-auto rounded-md border border-solid">
        <table className="w-full min-w-[52rem] table-fixed text-left text-xs">
          <thead className="bg-uzh-grey-20 sticky top-0 z-10">
            <tr>
              <th className="w-14 px-2 py-1">
                {t('manage.activityWizard.adaptive.assignments.use')}
              </th>
              <th className="w-64 px-2 py-1">
                {t('manage.activityWizard.adaptive.assignments.element')}
              </th>
              <th className="w-36 px-2 py-1">
                {t('manage.activityWizard.adaptive.assignments.leaf')}
              </th>
              <th className="w-28 px-2 py-1">
                {t('manage.activityWizard.adaptive.assignments.level')}
              </th>
              <th className="w-28 px-2 py-1">
                {t('manage.activityWizard.adaptive.assignments.effective')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleAssignments.map((assignment) => {
              const override = overrideByAssignment.get(assignment.id)
              const directEnabled = override?.enabled ?? true
              const effective = effectiveByAssignment.get(assignment.id)
              const coverage = coverageByCell.get(
                `${assignment.leafNodeId}:${assignment.levelId}`
              )
              const effectiveEnabled =
                !effectiveStateStale && effective
                  ? effective.effectiveEnabled
                  : assignment.enabled &&
                    coverage?.enabled === true &&
                    directEnabled &&
                    isNodeLocallyEnabled(
                      assignment.leafNodeId,
                      nodeById,
                      nodeOverrideById
                    )
              const available = effective?.available ?? true
              const controlledAnswerReady =
                effective?.controlledAnswerReady ?? true

              return (
                <tr
                  key={assignment.id}
                  className="border-uzh-grey-80 border-b last:border-b-0"
                  data-cy={`adaptive-assignment-${assignment.id}`}
                >
                  <td className="px-2 py-1.5">
                    <label
                      className="sr-only"
                      htmlFor={`adaptive-assignment-enabled-${assignment.id}`}
                    >
                      {t('manage.activityWizard.adaptive.assignments.use')}:{' '}
                      {assignment.elementName}
                    </label>
                    <Checkbox
                      id={`adaptive-assignment-enabled-${assignment.id}`}
                      checked={directEnabled}
                      onCheck={() =>
                        updateAssignment(assignment, {
                          enabled: !directEnabled,
                        })
                      }
                      data={{
                        cy: `adaptive-assignment-enabled-${assignment.id}`,
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div
                      className="truncate font-bold"
                      title={assignment.elementName}
                    >
                      {assignment.elementName}
                    </div>
                    <div className="text-slate-600">
                      #{assignment.elementId} | {assignment.elementType}
                    </div>
                  </td>
                  <td
                    className="truncate px-2 py-1.5"
                    title={getNodeBreadcrumb(assignment.leafNodeId, nodeById)}
                  >
                    {getNodeBreadcrumb(assignment.leafNodeId, nodeById)}
                  </td>
                  <td className="px-2 py-1.5">
                    {levelById.get(assignment.levelId)?.label ??
                      assignment.levelId}
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={
                        effectiveEnabled && available && controlledAnswerReady
                          ? 'font-bold text-green-700'
                          : 'font-bold text-red-700'
                      }
                    >
                      {t(
                        effectiveEnabled && available && controlledAnswerReady
                          ? 'manage.activityWizard.adaptive.assignments.included'
                          : 'manage.activityWizard.adaptive.assignments.excluded'
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {filteredAssignments.length > 0 ? (
        <Pagination
          totalPages={totalPages}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          numOfObjects={filteredAssignments.length}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      ) : null}

      <CoverageMatrix
        coverages={coverages}
        readiness={coverageReadiness}
        levels={sortedLevels}
        nodeById={nodeById}
      />
    </section>
  )
}

function CoverageMatrix({
  coverages,
  readiness,
  levels,
  nodeById,
}: {
  coverages: AdaptiveCoverageData[]
  readiness?: AdaptiveCoverageReadinessData[]
  levels: AdaptiveAssignmentLevelData[]
  nodeById: Map<number, AdaptiveAssignmentNodeData>
}) {
  const t = useTranslations()
  const readinessByCell = new Map(
    readiness?.map((cell) => [`${cell.leafNodeId}:${cell.levelId}`, cell]) ?? []
  )
  const leafIds = Array.from(
    new Set(coverages.map((coverage) => coverage.leafNodeId))
  )

  return (
    <div className="mt-4 min-w-0 max-w-full" data-cy="adaptive-coverage-matrix">
      <div className="mb-1 font-bold">
        {t('manage.activityWizard.adaptive.coverage.title')}
      </div>
      <div className="border-uzh-grey-80 max-h-64 w-full min-w-0 max-w-full overflow-auto rounded-md border border-solid">
        <table className="w-full min-w-[42rem] border-collapse text-xs">
          <thead className="bg-uzh-grey-20 sticky top-0 z-20">
            <tr>
              <th className="bg-uzh-grey-20 sticky left-0 z-30 min-w-48 px-2 py-1 text-left">
                {t('manage.activityWizard.adaptive.coverage.leaf')}
              </th>
              {levels.map((level) => (
                <th key={level.id} className="min-w-24 px-2 py-1 text-center">
                  {level.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leafIds.map((leafId) => (
              <tr key={leafId} className="border-uzh-grey-80 border-t">
                <th className="bg-background sticky left-0 truncate px-2 py-1 text-left">
                  {getNodeBreadcrumb(leafId, nodeById)}
                </th>
                {levels.map((level) => {
                  const coverage = coverages.find(
                    (value) =>
                      value.leafNodeId === leafId && value.levelId === level.id
                  )
                  const cell = readinessByCell.get(`${leafId}:${level.id}`)

                  return (
                    <td
                      key={level.id}
                      className={
                        cell
                          ? cell.ready
                            ? 'bg-green-50 px-2 py-1 text-center text-green-900'
                            : 'bg-red-50 px-2 py-1 text-center text-red-900'
                          : 'px-2 py-1 text-center'
                      }
                      data-cy={`adaptive-coverage-${leafId}-${level.id}`}
                    >
                      {coverage?.enabled === false || !coverage
                        ? '-'
                        : `${cell?.enabledAssignmentCount ?? '-'}/${coverage.targetItemCount}`}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function getNodeBreadcrumb(
  nodeId: number,
  nodeById: Map<number, AdaptiveAssignmentNodeData>
): string {
  const names: string[] = []
  const visited = new Set<number>()
  let current = nodeById.get(nodeId)

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    names.push(current.name)
    current =
      typeof current.parentId === 'number'
        ? nodeById.get(current.parentId)
        : undefined
  }

  return names.length > 0 ? names.reverse().join(' / ') : String(nodeId)
}

function isNodeLocallyEnabled(
  nodeId: number,
  nodeById: Map<number, AdaptiveAssignmentNodeData>,
  overrideById: Map<
    number,
    AdaptivePracticeQuizConfigFormValues['nodeOverrides'][number]
  >
): boolean {
  const visited = new Set<number>()
  let current = nodeById.get(nodeId)

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    if (overrideById.get(current.id)?.enabled === false) return false
    current =
      typeof current.parentId === 'number'
        ? nodeById.get(current.parentId)
        : undefined
  }

  return true
}

export default AdaptiveAssignmentPreview
