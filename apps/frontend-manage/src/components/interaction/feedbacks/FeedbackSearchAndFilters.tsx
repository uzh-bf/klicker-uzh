// TODO: eliminate duplicated content and imporve layout instead dynamically

import { faFilter, faPrint } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Button,
  Checkbox,
  Dropdown,
  Select,
  ThemeContext,
} from '@uzh-bf/design-system'
import { useContext } from 'react'
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

const defaultProps = {
  disabled: undefined,
  hidden: undefined,
  searchString: '',
  withSearch: false,
}

function FeedbackSearchAndFilters({
  disabled,
  hidden,
  withSearch,
  searchString,
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
  const theme = useContext(ThemeContext)

  const filter: {
    label: string
    checked: boolean
    onChange: () => void
  }[] = [
    {
      label: 'Gelöst',
      checked: showResolved,
      onChange: () => setShowResolved((current: boolean) => !current),
    },
    {
      label: 'Offen',
      checked: showOpen,
      onChange: () => setShowOpen((current: boolean) => !current),
    },
    {
      label: 'Ungepinnt',
      checked: showUnpinned,
      onChange: () => setShowUnpinned((current: boolean) => !current),
    },
    {
      label: 'Unveröffentlicht',
      checked: showUnpublished,
      onChange: () => setShowUnpublished((current: boolean) => !current),
    },
  ]

  // TODO: search seems to fail in some cases (e.g. when searching for "with" etc.), investigate and fix this bug
  return (
    <div
      className={twMerge(
        'flex flex-col items-stretch justify-between mt-4 md:items-end md:flex-row print:hidden',
        className
      )}
    >
      <div className="flex flex-row items-center">
        {withSearch && !hidden?.search && (
          <input
            disabled={disabled?.search}
            value={searchString}
            onChange={(e: any) => setSearchString(e.target.value)}
            placeholder="Suche..."
            className={twMerge(
              'py-2 px-1.5 border border-solid rounded-md border-uzh-grey-60 order-1 w-full md:mr-2 md:w-64 md:order-0',
              disabled?.search && 'cursor-not-allowed'
            )}
          />
        )}
        {!hidden?.filters && (
          <>
            <div className="block mr-1 md:mr-0 xl:hidden order-0 md:order-1">
              <Dropdown
                disabled={disabled?.filters}
                trigger={
                  <FontAwesomeIcon
                    icon={faFilter}
                    className={twMerge(
                      'p-2.5 border border-solid border-uzh-grey-60 rounded-md ml-2 shadow-md  hover:shadow-none',
                      `hover:${theme.primaryBg}`,
                      disabled?.filters && 'hover:bg-white shadow-none'
                    )}
                  />
                }
                items={filter.map((filter) => {
                  return {
                    label: (
                      <span
                        className={twMerge(
                          'flex items-center hover:cursor-pointer px-2 py-0.5',
                          `hover:${theme.primaryBgDark}`
                        )}
                      >
                        <Checkbox
                          checked={filter.checked}
                          onCheck={() => null}
                        />
                        {filter.label}
                      </span>
                    ),
                    onClick: filter.onChange,
                  }
                })}
              />
            </div>

            <div className="flex-row flex-wrap justify-between flex-initial order-1 hidden gap-3 mt-4 mb-1 ml-4 xl:flex md:mt-0">
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
                    />
                    {filter.label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-row">
        {!hidden?.print && (
          <Button
            className={{
              root: twMerge(
                'justify-center mt-4 w-11 h-11 md:mt-0',
                !hidden?.sorting && 'mr-2'
              ),
            }}
            onClick={() => window.print()}
            disabled={disabled?.print}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faPrint} />
            </Button.Icon>
          </Button>
        )}

        {!hidden?.sorting && (
          <Select
            disabled={disabled?.sorting}
            value={sortBy}
            items={[
              { value: 'votes', label: 'Nach Stimmen sortieren' },
              { value: 'recency', label: 'Nach Zeitpunkt sortieren' },
            ]}
            onChange={(newValue: string) => setSortBy(newValue)}
          />
        )}
      </div>
    </div>
  )
}

FeedbackSearchAndFilters.defaultProps = defaultProps

export default FeedbackSearchAndFilters
