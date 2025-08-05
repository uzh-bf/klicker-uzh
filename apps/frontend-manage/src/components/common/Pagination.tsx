import {
  Pagination as PaginationComponent,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { twMerge } from 'tailwind-merge'
import usePaginationPageNumbers from '../../lib/hooks/usePaginationPageNumbers'

function Pagination({
  totalPages,
  currentPage,
  setCurrentPage,
  numOfActivities,
  PAGE_SIZE,
  className,
}: {
  totalPages: number
  currentPage: number
  setCurrentPage: Dispatch<SetStateAction<number>>
  numOfActivities: number
  PAGE_SIZE: number
  className?: string
}) {
  const t = useTranslations()
  const pageNumbers = usePaginationPageNumbers({ currentPage, totalPages })

  return (
    <div
      className={twMerge('mt-6 flex flex-col items-center gap-4', className)}
    >
      <div className="text-muted-foreground text-sm">
        {t('manage.general.showingResults', {
          start: (currentPage - 1) * PAGE_SIZE + 1,
          end: Math.min(currentPage * PAGE_SIZE, numOfActivities),
          total: numOfActivities,
        })}
      </div>
      <PaginationComponent className="w-full">
        <PaginationContent className="justify-center">
          <PaginationItem>
            <PaginationPrevious
              size="default"
              label={t('manage.general.previousPage')}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
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
    </div>
  )
}

export default Pagination
