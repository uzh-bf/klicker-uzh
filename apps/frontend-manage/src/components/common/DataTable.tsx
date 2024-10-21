import { faDownload, faRepeat } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Button } from '@uzh-bf/design-system'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@uzh-bf/design-system/dist/future'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import CsvDownloader from 'react-csv-downloader'
import { twMerge } from 'tailwind-merge'

interface DataTableProps<TData, TValue> {
  columns: (ColumnDef<TData, TValue> & {
    accessorKey: string
    className?: string
    csvOnly?: boolean
  })[]
  data: TData[]
  csvFilename?: string
  className?: {
    table?: string
    tableHeader?: string
    tableCell?: string
  }
  footerContent?: React.ReactNode
  isPaginated?: boolean
  isResetSortingEnabled?: boolean
}

function DataTable<TData, TValue>({
  columns,
  data,
  csvFilename,
  className,
  footerContent,
  isPaginated,
  isResetSortingEnabled,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations()
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: isPaginated ? getPaginationRowModel() : undefined,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
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

  const csvColumns = useMemo(() => {
    return columns.map((column) => {
      return {
        id: column.accessorKey,
        label: column.header,
      }
    })
  }, [columns])

  return (
    <>
      <Table containerClassName={twMerge(className?.table)}>
        <TableHeader
          className={twMerge('bg-white shadow-sm', className?.tableHeader)}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
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
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={twMerge(className?.tableCell)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {t('shared.table.noResults')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>

        {typeof footerContent !== 'undefined' && (
          <TableFooter>
            <TableRow>{footerContent}</TableRow>
          </TableFooter>
        )}
      </Table>

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
            <Button>
              <Button.Icon>
                <FontAwesomeIcon icon={faDownload} />
              </Button.Icon>
              <Button.Label>{t('shared.table.download')}</Button.Label>
            </Button>
          </CsvDownloader>
        )}

        <div className="flex flex-row gap-2">
          {isResetSortingEnabled && (
            <Button onClick={() => setSorting([])}>
              <FontAwesomeIcon icon={faRepeat} />
              <div>{t('manage.evaluation.resetSorting')}</div>
            </Button>
          )}

          {isPaginated && (
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                {t('shared.table.previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                {t('shared.table.next')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default DataTable
