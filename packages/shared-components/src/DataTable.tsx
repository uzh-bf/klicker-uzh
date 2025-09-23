import { faDownload, faRepeat } from '@fortawesome/free-solid-svg-icons'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Button,
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableFooter,
  ShadcnTableHead,
  ShadcnTableHeader,
  ShadcnTableRow,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import React, { useMemo, useState } from 'react'
import CsvDownloader from 'react-csv-downloader'
import { twMerge } from 'tailwind-merge'

interface DataTableProps<TData, TValue> {
  columns: (ColumnDef<TData, TValue> & {
    accessorKey: string
    className?: string
    csvOnly?: boolean
    csvHidden?: boolean
    displayName?: string
  })[]
  data: TData[]
  csvFilename?: string
  className?: {
    table?: string
    tableHeader?: string
    tableRow?: string
    tableCell?: string
    buttons?: string
    buttonsContainer?: string
  }
  footerContent?: React.ReactNode
  isPaginated?: boolean
  initialPageSize?: number
  isResetSortingEnabled?: boolean
  initialSorting?: SortingState
  onRowClick?: (row: TData) => void
  getRowClassName?: (row: TData) => string | undefined
}

function DataTable<TData, TValue>({
  columns,
  data,
  csvFilename,
  className,
  footerContent,
  isPaginated,
  isResetSortingEnabled,
  initialSorting,
  initialPageSize,
  onRowClick,
  getRowClassName,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations()
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? [])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: isPaginated ? getPaginationRowModel() : undefined,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: initialPageSize ?? 10 },
    },
    state: {
      columnVisibility: columns.reduce<Record<string, boolean>>(
        (acc, column) => ({
          ...acc,
          [column.accessorKey]: !column.csvOnly,
        }),
        {}
      ),
      sorting,
    },
  })

  const csvColumns = useMemo(
    () =>
      columns
        .filter((column) => !column.csvHidden)
        .map((column) => ({
          id: column.accessorKey,
          label: column.header,
          displayName: column.displayName,
        })),
    [columns]
  )

  return (
    <>
      <ShadcnTable containerClassName={twMerge(className?.table)}>
        <ShadcnTableHeader
          className={twMerge('bg-white shadow-sm', className?.tableHeader)}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <ShadcnTableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <ShadcnTableHead
                  key={header.id}
                  className={twMerge(
                    className?.tableCell,
                    columns.find((c) => c.accessorKey === header.id)?.className
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </ShadcnTableHead>
              ))}
            </ShadcnTableRow>
          ))}
        </ShadcnTableHeader>
        <ShadcnTableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <ShadcnTableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                onClick={() => onRowClick?.(row.original)}
                className={twMerge(
                  className?.tableRow,
                  getRowClassName?.(row.original)
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <ShadcnTableCell
                    key={cell.id}
                    className={twMerge(className?.tableCell)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </ShadcnTableCell>
                ))}
              </ShadcnTableRow>
            ))
          ) : (
            <ShadcnTableRow>
              <ShadcnTableCell
                colSpan={columns.length}
                className="h-24 text-center"
              >
                {t('shared.table.noResults')}
              </ShadcnTableCell>
            </ShadcnTableRow>
          )}
        </ShadcnTableBody>

        {typeof footerContent !== 'undefined' && (
          <ShadcnTableFooter>
            <ShadcnTableRow>{footerContent}</ShadcnTableRow>
          </ShadcnTableFooter>
        )}
      </ShadcnTable>

      <div className="flex items-center justify-between space-x-2 py-2 text-sm">
        {typeof csvFilename === 'string' && (
          <CsvDownloader
            meta
            wrapColumnChar='"'
            suffix={dayjs().format('YYYY-MM-DD')}
            filename={csvFilename}
            columns={csvColumns}
            datas={data as Record<string, string | undefined | null>[]}
            separator=";"
          >
            <Button className={{ root: twMerge('h-8', className?.buttons) }}>
              <Button.Icon icon={faDownload} />
              <Button.Label>{t('shared.table.download')}</Button.Label>
            </Button>
          </CsvDownloader>
        )}

        <div
          className={twMerge(
            'flex flex-row gap-2',
            className?.buttonsContainer
          )}
        >
          {isResetSortingEnabled && (
            <Button
              onClick={() => setSorting([])}
              className={{ root: twMerge('h-8', className?.buttons) }}
            >
              <Button.Icon icon={faRepeat} />
              <Button.Label>{t('manage.evaluation.resetSorting')}</Button.Label>
            </Button>
          )}

          {isPaginated && (
            <div className="space-x-2">
              <Button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className={{ root: twMerge('h-8', className?.buttons) }}
              >
                <Button.Label>{t('shared.table.previous')}</Button.Label>
              </Button>
              <Button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className={{ root: twMerge('h-8', className?.buttons) }}
              >
                <Button.Label>{t('shared.table.next')}</Button.Label>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default DataTable
