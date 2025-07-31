// TODO: eliminate duplicated content and improve layout instead dynamically

import {
  faFilter,
  faMagnifyingGlass,
  faPrint,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Button,
  Checkbox,
  Dropdown,
  Select,
  TextField,
} from '@uzh-bf/design-system'
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
          <TextField
            disabled={disabled?.search}
            value={searchString}
            onChange={(e: any) => setSearchString(e.target.value)}
            placeholder={t('manage.general.searchPlaceholder')}
            className={{
              field: 'md:order-0 order-1 w-full md:mr-2 md:w-64',
              input: 'pl-8!',
            }}
            icon={faMagnifyingGlass}
          />
        )}
        {!hidden?.filters && (
          <>
            <div className="order-0 mr-1 block md:order-1 md:mr-0 xl:hidden">
              <Dropdown
                disabled={disabled?.filters}
                trigger={<FontAwesomeIcon icon={faFilter} />}
                items={filter.map((filter) => {
                  return {
                    id: `feedback-channel-filter-${filter.label}`,
                    type: 'checkbox',
                    label: filter.label,
                    selected: filter.checked,
                    onClick: filter.onChange,
                    data: { cy: `feedback-channel-filter-${filter.label}` },
                  }
                })}
                className={{ trigger: 'h-9 w-9' }}
                data={{ cy: 'feedback-channel-mobile-filter-button' }}
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
            className={{
              root: twMerge('h-9 w-9', !hidden?.sorting && 'mr-2'),
            }}
            onClick={() => window.print()}
            disabled={disabled?.print}
            data={{ cy: 'print-feedback-channel-button' }}
          >
            <Button.Icon withoutLabel icon={faPrint} />
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
            className={{ trigger: 'h-9' }}
          />
        )}
      </div>
    </div>
  )
}

export default FeedbackSearchAndFilters
