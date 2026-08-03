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
import { type Dispatch, type SetStateAction, useId } from 'react'
import { twMerge } from 'tailwind-merge'
import usePaginationPageNumbers from '../../../lib/hooks/usePaginationPageNumbers'

function CompetenceTreePagination({
  totalPages,
  currentPage,
  setCurrentPage,
  numOfObjects,
  pageSize,
  setPageSize,
  className,
}: {
  totalPages: number
  currentPage: number
  setCurrentPage: Dispatch<SetStateAction<number>>
  numOfObjects: number
  pageSize: number
  setPageSize: Dispatch<SetStateAction<number>>
  className?: string
}) {
  const t = useTranslations()
  const pageSizeId = useId()
  const pageNumbers = usePaginationPageNumbers({ currentPage, totalPages })

  return (
    <div
      className={twMerge(
        'mt-2 flex flex-col items-center gap-4 lg:mt-4',
        className
      )}
    >
      <div
        className={twMerge(
          'flex w-full flex-col items-center lg:grid lg:flex-none lg:grid-cols-3',
          totalPages > 1 && '-mb-2'
        )}
      >
        <div />
        <div className="text-muted-foreground order-2 text-center text-sm lg:order-1">
          {t('manage.general.showingResults', {
            start: (currentPage - 1) * pageSize + 1,
            end: Math.min(currentPage * pageSize, numOfObjects),
            total: numOfObjects,
          })}
        </div>
        <div className="order-1 mb-2.5 self-end lg:order-2 lg:mb-0">
          <label className="sr-only" htmlFor={pageSizeId}>
            {t('manage.general.NEntriesPerPage', { N: pageSize })}
          </label>
          <Select
            id={pageSizeId}
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
            ]}
            value={String(pageSize)}
            onChange={(value) => setPageSize(parseInt(value, 10))}
            className={{
              root: 'justify-end',
              trigger: 'h-7.5 w-52 text-sm',
              item: 'text-sm',
            }}
            data={{ cy: 'pagination-page-size' }}
          />
        </div>
      </div>
      {totalPages > 1 ? (
        <PaginationComponent className="w-full">
          <PaginationContent className="justify-center">
            <PaginationItem>
              <PaginationPrevious
                size="default"
                label={t('manage.general.previousPage')}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className={twMerge(
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
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    size="default"
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                    data-cy={`pagination-page-${page}`}
                  >
                    {page}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                size="default"
                label={t('manage.general.nextPage')}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                className={twMerge(
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
      ) : null}
    </div>
  )
}

export default CompetenceTreePagination
