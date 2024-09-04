import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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

function TableWithDownload({
  columns,
  items,
  itemIdentifier,
  csvFilename,
  summary,
  className,
}: {
  columns: {
    id: string
    label: string
  }[]
  items: Record<string, string | number | null>[]
  itemIdentifier: string
  csvFilename?: string
  summary?: React.ReactNode
  className?: {
    table?: string
    tableHeader?: string
    tableCell?: string
  }
}) {
  const t = useTranslations()

  const data = useMemo(() => {
    return items.map((item) => {
      return columns.reduce<Record<string, string | number | null>>(
        (acc, column) => {
          return {
            ...acc,
            [itemIdentifier]: item[itemIdentifier],
            [column.id]: item[column.id] ?? '',
          }
        },
        {}
      )
    })
  }, [columns, items, itemIdentifier])

  return (
    <div>
      <Table
        className=""
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
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.id} className={className?.tableCell}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody className="">
          {data.map((item) => (
            <TableRow key={item[itemIdentifier]}>
              {columns.map((column) => (
                <TableCell
                  key={item[itemIdentifier] + column.id}
                  className={className?.tableCell}
                >
                  {item[column.id]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {typeof csvFilename === 'string' && (
        <div className="mt-4 flex flex-row justify-between text-sm text-gray-500">
          <div>{summary}</div>
          <CsvDownloader
            meta
            wrapColumnChar='"'
            suffix={dayjs().format('YYYY-MM-DD')}
            filename={csvFilename}
            columns={columns}
            datas={data as Record<string, string>[]}
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

export default TableWithDownload
