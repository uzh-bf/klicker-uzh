import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Button } from '@uzh-bf/design-system'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@uzh-bf/design-system/dist/future'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import CsvDownloader from 'react-csv-downloader'
import { twMerge } from 'tailwind-merge'

interface DataTableProps<TData, TValue> {
  columns: (ColumnDef<TData, TValue> & {
    accessorKey: string
    csvOnly?: boolean
  })[]
  data: TData[]
  csvFilename?: string
  className?: {
    table?: string
    tableHeader?: string
    tableCell?: string
  }
}

function DataTable<TData, TValue>({
  columns,
  data,
  csvFilename,
  className,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations()

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      columnVisibility: columns.reduce<Record<string, boolean>>(
        (acc, column) => ({
          ...acc,
          [column.accessorKey]: !column.csvOnly,
        }),
        {}
      ),
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
    <div>
      <div className="flex items-center justify-end space-x-2 py-4">
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

      <Table
        containerClassName={twMerge(
          'h-fit max-h-[500px] overflow-y-auto relative',
          className?.table
        )}
      >
        <TableHeader
          className={twMerge(
            'sticky top-0 z-10 bg-white shadow-sm',
            className?.tableHeader
          )}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={twMerge(className?.tableCell)}
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
      </Table>

      {typeof csvFilename === 'string' && (
        <div className="mt-4 text-right text-sm italic text-gray-500">
          <CsvDownloader
            meta
            wrapColumnChar='"'
            suffix={dayjs().format('YYYY-MM-DD')}
            filename={csvFilename}
            columns={csvColumns}
            datas={data}
            separator=";"
          >
            <Button>
              <Button.Icon>
                <FontAwesomeIcon icon={faDownload} />
              </Button.Icon>
              <Button.Label>{t('shared.table.download')}</Button.Label>
            </Button>
          </CsvDownloader>
        </div>
      )}
    </div>
  )
}

export default DataTable
