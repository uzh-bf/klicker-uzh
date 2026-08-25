import {
  Pagination as PaginationComponent,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Select,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import usePaginationPageNumbers from '../../lib/hooks/usePaginationPageNumbers'

export type PaginationPageSize = 10 | 20 | 50 | 'all'

export function isPaginationPageSize(
  value: unknown
): value is PaginationPageSize {
  return value === 10 || value === 20 || value === 50 || value === 'all'
}

function Pagination({
  totalPages,
  currentPage,
  setCurrentPage,
  numOfObjects,
  pageSize,
  setPageSize,
  showAll = false,
  className,
}: {
  totalPages: number
  currentPage: number
  setCurrentPage: Dispatch<SetStateAction<number>>
  numOfObjects: number
  pageSize: PaginationPageSize
  setPageSize: (value: PaginationPageSize) => void
  showAll?: boolean
  className?: string
}) {
  const t = useTranslations()
  const pageNumbers = usePaginationPageNumbers({ currentPage, totalPages })

  return (
    <div
      className={twMerge(
        'mt-2 flex w-full flex-col items-center gap-2 lg:mt-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-4',
        className
      )}
    >
      {/* Left zone: result range summary */}
      <div className="text-muted-foreground text-center text-xs lg:col-start-1 lg:justify-self-start lg:text-left">
        {t('manage.general.showingResults', {
          start: pageSize === 'all' ? 1 : (currentPage - 1) * pageSize + 1,
          end:
            pageSize === 'all'
              ? numOfObjects
              : Math.min(currentPage * pageSize, numOfObjects),
          total: numOfObjects,
        })}
      </div>

      {/* Center zone: page navigation. It is empty:hidden on single-page lists,
          so each zone pins its own lg:col-start-* to keep the left and right
          zones anchored to their columns even when this one collapses out. */}
      <div className="flex empty:hidden lg:col-start-2">
        {totalPages > 1 && (
          <PaginationComponent className="w-auto">
            <PaginationContent className="justify-center gap-1">
              <PaginationItem>
                <PaginationPrevious
                  label={t('manage.general.previousPage')}
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  className={twMerge(
                    'h-8 gap-1 px-2 text-xs',
                    currentPage === 1
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  )}
                  aria-disabled={currentPage === 1}
                  data-cy="pagination-previous"
                />
              </PaginationItem>

              {pageNumbers.map((page, index) => (
                <PaginationItem key={index}>
                  {page === 'ellipsis' ? (
                    <PaginationEllipsis className="h-8 w-8" />
                  ) : (
                    <PaginationLink
                      size="default"
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="h-8 min-w-8 cursor-pointer px-2 text-xs"
                      data-cy={`pagination-page-${page}`}
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  label={t('manage.general.nextPage')}
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  className={twMerge(
                    'h-8 gap-1 px-2 text-xs',
                    currentPage === totalPages
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  )}
                  aria-disabled={currentPage === totalPages}
                  data-cy="pagination-next"
                />
              </PaginationItem>
            </PaginationContent>
          </PaginationComponent>
        )}
      </div>

      {/* Right zone: entries-per-page selector */}
      <Select
        items={[
          {
            value: '10',
            label: t('manage.general.NEntriesPerPage', { N: 10 }),
            data: { cy: 'pagination-page-size-10' },
          },
          {
            value: '20',
            label: t('manage.general.NEntriesPerPage', { N: 20 }),
            data: { cy: 'pagination-page-size-20' },
          },
          {
            value: '50',
            label: t('manage.general.NEntriesPerPage', { N: 50 }),
            data: { cy: 'pagination-page-size-50' },
          },
          ...(showAll
            ? [
                {
                  value: 'all',
                  label: t('manage.catalog.all'),
                  data: { cy: 'pagination-page-size-all' },
                },
              ]
            : []),
        ]}
        value={String(pageSize)}
        onChange={(value) => {
          setCurrentPage(1)
          const parsedPageSize =
            value === 'all' ? 'all' : Number.parseInt(value, 10)
          if (isPaginationPageSize(parsedPageSize)) {
            setPageSize(parsedPageSize)
          }
        }}
        className={{
          root: 'lg:col-start-3 lg:justify-self-end',
          trigger: 'h-8 w-44 text-xs',
          item: 'text-xs',
        }}
        data={{ cy: 'pagination-page-size' }}
      />
    </div>
  )
}

export default Pagination
