// TODO: eliminate duplicated content and improve layout instead dynamically

import { faFilter, faPrint } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Checkbox, Dropdown, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface Props {
  disabled?: {
    search?: boolean
    filters?: boolean
    print?: boolean
    sorting?: boolean
  }
  hidden?: {
    search?: boolean
    filters?: boolean
    print?: boolean
    sorting?: boolean
  }
  searchString?: string
  withSearch?: boolean
  showResolved: boolean
  showOpen: boolean
  showUnpinned: boolean
  showUnpublished: boolean
  sortBy: string
  setSearchString: (str: string) => void
  setSortBy: (str: string) => void
  setShowResolved: (fun: any) => void
  setShowOpen: (fun: any) => void
  setShowUnpinned: (fun: any) => void
  setShowUnpublished: (fun: any) => void
  className?: string
}

function FeedbackSearchAndFilters({
  disabled,
  hidden,
  withSearch = false,
  searchString = '',
  setSearchString,
  showResolved,
  setShowResolved,
  showOpen,
  setShowOpen,
  showUnpinned,
  setShowUnpinned,
  showUnpublished,
  setShowUnpublished,
  sortBy,
  setSortBy,
  className,
}: Props) {
  const t = useTranslations()
  const filter: {
    label: string
    checked: boolean
    onChange: () => void
  }[] = [
    {
      label: t('manage.cockpit.filterSolved'),
      checked: showResolved,
      onChange: () => setShowResolved((current: boolean) => !current),
    },
    {
      label: t('manage.cockpit.filterOpen'),
      checked: showOpen,
      onChange: () => setShowOpen((current: boolean) => !current),
    },
    {
      label: t('manage.cockpit.filterUnpinned'),
      checked: showUnpinned,
      onChange: () => setShowUnpinned((current: boolean) => !current),
    },
    {
      label: t('manage.cockpit.filterUnpublished'),
      checked: showUnpublished,
      onChange: () => setShowUnpublished((current: boolean) => !current),
    },
  ]

  // TODO: search seems to fail in some cases (e.g. when searching for "with" etc.), investigate and fix this bug
  return (
    <div
      className={twMerge(
        'mt-4 flex flex-col items-stretch justify-between md:flex-row md:items-end print:hidden',
        className
      )}
    >
      <div className="flex flex-row items-center">
        {withSearch && !hidden?.search && (
          <input
            disabled={disabled?.search}
            value={searchString}
            onChange={(e: any) => setSearchString(e.target.value)}
            placeholder={t('manage.general.searchPlaceholder')}
            className={twMerge(
              'border-uzh-grey-60 md:order-0 order-1 w-full rounded-md border border-solid px-1.5 py-2 md:mr-2 md:w-64',
              disabled?.search && 'cursor-not-allowed'
            )}
          />
        )}
        {!hidden?.filters && (
          <>
            <div className="order-0 mr-1 block md:order-1 md:mr-0 xl:hidden">
              <Dropdown
                disabled={disabled?.filters}
                trigger={
                  <FontAwesomeIcon
                    icon={faFilter}
                    className={twMerge(
                      'border-uzh-grey-60 hover:bg-primary-20 ml-2 rounded-md border border-solid p-2.5 shadow-md hover:shadow-none',
                      disabled?.filters && 'shadow-none hover:bg-white'
                    )}
                  />
                }
                items={filter.map((filter) => {
                  return {
                    label: (
                      <span
                        className={twMerge(
                          'hover:bg-primary-60 flex items-center px-2 py-0.5 hover:cursor-pointer'
                        )}
                      >
                        <Checkbox
                          checked={filter.checked}
                          onCheck={() => null}
                          disabled={disabled?.filters}
                          className={{ root: 'mr-2' }}
                        />
                        {filter.label}
                      </span>
                    ),
                    onClick: filter.onChange,
                    data: { cy: `feedback-channel-filter-${filter.label}` },
                  }
                })}
                data={{ cy: 'feedback-channel-mobile-filter-dropdown' }}
              />
            </div>

            <div className="order-1 mb-1 ml-4 mt-4 hidden flex-initial flex-row flex-wrap justify-between gap-3 md:mt-0 xl:flex">
              {filter.map((filter) => (
                <div className="inline-block" key={filter.label}>
                  <span
                    className={twMerge(
                      'flex items-center',
                      disabled?.filters && 'text-gray-500'
                    )}
                  >
                    <Checkbox
                      checked={filter.checked}
                      onCheck={filter.onChange}
                      disabled={disabled?.filters}
                      label={filter.label}
                      className={{ label: 'mr-2' }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-row items-center">
        {!hidden?.print && (
          <Button
            basic
            className={{
              root: twMerge(
                'hover:bg-primary-20 flex h-9 w-9 items-center justify-center rounded-md',
                !hidden?.sorting && 'mr-2'
              ),
            }}
            onClick={() => window.print()}
            disabled={disabled?.print}
            data={{ cy: 'print-feedback-channel-button' }}
          >
            <FontAwesomeIcon icon={faPrint} />
          </Button>
        )}

        {!hidden?.sorting && (
          <Select
            disabled={disabled?.sorting}
            value={sortBy}
            items={[
              {
                value: 'votes',
                label: t('manage.cockpit.sortByVotes'),
                data: { cy: 'sort-by-votes' },
              },
              {
                value: 'recency',
                label: t('manage.cockpit.sortByTime'),
                data: { cy: 'sort-by-time' },
              },
            ]}
            onChange={(newValue: string) => setSortBy(newValue)}
            data={{ cy: 'sort-feedback-channel-select' }}
          />
        )}
      </div>
    </div>
  )
}

export default FeedbackSearchAndFilters
