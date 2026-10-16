import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { TextField, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  XAxis,
  YAxis,
} from 'recharts'
import CalibrationStatus from './CalibrationStatus'
import CompetenceTreePagination from './CompetenceTreePagination'
import {
  buildItemBankMap,
  filterItemBankItems,
  type ItemBankAssignment,
  type ItemBankCalibration,
  type ItemBankCalibrationStatus,
  type ItemBankScaleLevel,
} from './itemBankMapModel'

const DEFAULT_PAGE_SIZE = 20

const STATUS_COLORS: Record<ItemBankCalibrationStatus, string> = {
  CALIBRATED: '#167D3C',
  PILOT: '#2167A5',
  PROVISIONAL: '#64748B',
  FLAGGED: '#B91C1C',
  RETIRED: '#94A3B8',
  MISSING: '#B45309',
}

type ItemShape = 'circle' | 'triangle' | 'diamond' | 'square' | 'star'

const ELEMENT_SHAPES: Partial<Record<ElementType, ItemShape>> = {
  [ElementType.Numerical]: 'circle',
  [ElementType.Sc]: 'triangle',
  [ElementType.Mc]: 'diamond',
  [ElementType.Kprim]: 'square',
  [ElementType.FreeText]: 'star',
}

const ELEMENT_TYPE_KEYS: Partial<
  Record<
    ElementType,
    | 'shared.types.NUMERICAL'
    | 'shared.types.SC'
    | 'shared.types.MC'
    | 'shared.types.KPRIM'
    | 'shared.types.FREE_TEXT'
  >
> = {
  [ElementType.Numerical]: 'shared.types.NUMERICAL',
  [ElementType.Sc]: 'shared.types.SC',
  [ElementType.Mc]: 'shared.types.MC',
  [ElementType.Kprim]: 'shared.types.KPRIM',
  [ElementType.FreeText]: 'shared.types.FREE_TEXT',
} as const

function ItemBankMap({
  assignments,
  calibrations,
  levels,
  gridMin,
  gridMax,
  gridStep,
}: {
  assignments: ItemBankAssignment[]
  calibrations: ItemBankCalibration[]
  levels: ItemBankScaleLevel[]
  gridMin: number
  gridMax: number
  gridStep: number
}) {
  const t = useTranslations()
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const map = useMemo(
    () =>
      buildItemBankMap({
        assignments,
        calibrations,
        levels,
        gridMin,
        gridMax,
        gridStep,
      }),
    [assignments, calibrations, gridMax, gridMin, gridStep, levels]
  )
  const itemGroups = useMemo(() => {
    const types = Array.from(new Set(map.items.map((item) => item.elementType)))
    return types.map((type) => ({
      type,
      items: map.items
        .filter((item) => item.elementType === type)
        .map((item, index) => ({
          ...item,
          y: 1 + (index % 3) * 0.18,
        })),
    }))
  }, [map.items])
  const filteredItems = useMemo(
    () => filterItemBankItems(map.items, search),
    [map.items, search]
  )
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const visibleItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  return (
    <section
      className="border-t border-slate-300 py-5"
      data-cy="adaptive-item-bank-map"
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold">
          {t('manage.competenceTree.itemBank.title')}
        </h3>
        <p className="text-sm text-slate-600">
          {t('manage.competenceTree.itemBank.description')}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            'CALIBRATED',
            'PILOT',
            'PROVISIONAL',
            'FLAGGED',
            'RETIRED',
            'MISSING',
          ] as const
        ).map((status) => (
          <CalibrationStatus
            key={status}
            status={status}
            count={map.counts[status]}
          />
        ))}
      </div>

      {map.missingCutNeighborhoods.length > 0 ? (
        <div className="mb-4 space-y-2">
          {map.missingCutNeighborhoods.map((cut, index) => (
            <UserNotification
              key={`${cut.levelLabel}-${cut.position}`}
              type="warning"
              message={t('manage.competenceTree.itemBank.missingCut', {
                level: cut.levelLabel,
              })}
              data={{ cy: `adaptive-item-bank-gap-${index}` }}
            />
          ))}
        </div>
      ) : null}

      <div className="h-72 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            accessibilityLayer={false}
            data={map.information}
            margin={{ top: 16, right: 24, bottom: 28, left: 8 }}
          >
            <CartesianGrid vertical horizontal={false} stroke="#CBD5E1" />
            <XAxis
              type="number"
              dataKey="position"
              domain={map.domain}
              allowDataOverflow
              tickCount={7}
              label={{
                value: t('manage.competenceTree.itemBank.axis'),
                position: 'bottom',
                offset: 10,
              }}
            />
            <YAxis yAxisId="items" domain={[0.75, 1.75]} hide />
            <YAxis yAxisId="information" orientation="right" hide />
            <Area
              yAxisId="information"
              type="monotone"
              dataKey="information"
              stroke="#4D7198"
              fill="#D9E8F5"
              fillOpacity={0.65}
              isAnimationActive={false}
            />
            {map.cuts.map((cut) => (
              <ReferenceLine
                key={`${cut.levelLabel}-${cut.position}`}
                yAxisId="items"
                x={cut.position}
                stroke={cut.hasNearbyCalibratedItems ? '#334155' : '#B45309'}
                strokeDasharray="4 3"
              />
            ))}
            {itemGroups.map((group) => (
              <Scatter
                key={group.type}
                yAxisId="items"
                data={group.items}
                dataKey="y"
                shape={(props: { cx?: number; cy?: number; fill?: string }) => (
                  <ItemShapeMark
                    {...props}
                    itemShape={
                      ELEMENT_SHAPES[group.type as ElementType] ?? 'circle'
                    }
                  />
                )}
                isAnimationActive={false}
              >
                {group.items.map((item) => (
                  <Cell
                    key={item.assignmentId}
                    fill={STATUS_COLORS[item.status]}
                    stroke="#FFFFFF"
                  />
                ))}
              </Scatter>
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 max-w-md">
        <label
          className="mb-1 block text-sm font-medium"
          htmlFor="adaptive-item-bank-search"
        >
          {t('manage.competenceTree.itemBank.search')}
        </label>
        <TextField
          id="adaptive-item-bank-search"
          value={search}
          onChange={(value) => {
            setSearch(value)
            setCurrentPage(1)
          }}
          data={{ cy: 'adaptive-item-bank-search' }}
        />
      </div>

      <div className="mt-3 overflow-x-auto border-y border-slate-200">
        <table className="w-full min-w-[48rem] table-fixed text-left text-sm">
          <caption className="sr-only">
            {t('manage.competenceTree.itemBank.tableCaption')}
          </caption>
          <thead className="bg-slate-100 text-xs font-semibold text-slate-600">
            <tr>
              <th className="w-64 px-3 py-2" scope="col">
                {t('manage.competenceTree.element')}
              </th>
              <th className="w-32 px-3 py-2" scope="col">
                {t('manage.competenceTree.elementType')}
              </th>
              <th className="w-40 px-3 py-2" scope="col">
                {t('manage.competenceTree.expectedDifficulty')}
              </th>
              <th className="w-40 px-3 py-2" scope="col">
                {t('manage.competenceTree.calibration.title')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.assignmentId} className="border-t border-slate-200">
                <th className="truncate px-3 py-2 font-medium" scope="row">
                  {item.elementName}
                </th>
                <td className="px-3 py-2">
                  <ElementTypeLabel type={item.elementType} />
                </td>
                <td className="px-3 py-2">
                  {item.levelLabel || '-'}
                  <span className="ml-1 text-xs text-slate-500">
                    {t(
                      `manage.competenceTree.itemBank.positionSource.${item.positionSource}`
                    )}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <CalibrationStatus
                    status={item.status}
                    assignmentId={item.assignmentId}
                  />
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-slate-600" colSpan={4}>
                  {t('manage.competenceTree.itemBank.empty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {filteredItems.length > 0 ? (
        <CompetenceTreePagination
          totalPages={totalPages}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          numOfObjects={filteredItems.length}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      ) : null}
    </section>
  )
}

function ElementTypeLabel({ type }: { type: string }) {
  const t = useTranslations()
  const key = ELEMENT_TYPE_KEYS[type as ElementType]
  return <>{key ? t(key) : type}</>
}

function ItemShapeMark({
  cx = 0,
  cy = 0,
  fill = '#64748B',
  itemShape,
}: {
  cx?: number
  cy?: number
  fill?: string
  itemShape: ItemShape
}) {
  const common = { fill, stroke: '#FFFFFF', strokeWidth: 1.5 }
  if (itemShape === 'triangle') {
    return (
      <path
        d={`M ${cx} ${cy - 7} L ${cx + 7} ${cy + 6} L ${cx - 7} ${cy + 6} Z`}
        {...common}
      />
    )
  }
  if (itemShape === 'diamond') {
    return (
      <path
        d={`M ${cx} ${cy - 7} L ${cx + 7} ${cy} L ${cx} ${cy + 7} L ${cx - 7} ${cy} Z`}
        {...common}
      />
    )
  }
  if (itemShape === 'square') {
    return <rect x={cx - 6} y={cy - 6} width={12} height={12} {...common} />
  }
  if (itemShape === 'star') {
    return (
      <path
        d={`M ${cx} ${cy - 7} L ${cx + 2} ${cy - 2} L ${cx + 7} ${cy - 2} L ${cx + 3} ${cy + 1} L ${cx + 5} ${cy + 7} L ${cx} ${cy + 3} L ${cx - 5} ${cy + 7} L ${cx - 3} ${cy + 1} L ${cx - 7} ${cy - 2} L ${cx - 2} ${cy - 2} Z`}
        {...common}
      />
    )
  }
  return <circle cx={cx} cy={cy} r={6} {...common} />
}

export default ItemBankMap
