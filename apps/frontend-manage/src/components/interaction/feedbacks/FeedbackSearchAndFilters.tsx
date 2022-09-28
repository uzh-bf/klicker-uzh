// TODO: eliminate duplicated content and imporve layout instead dynamically

import {
  faArrowUpShortWide,
  faFilter,
  faPrint,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Checkbox, Dropdown, ThemeContext } from '@uzh-bf/design-system'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
// import { Input } from 'semantic-ui-react'

interface Props {
  disabled?: boolean
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
}

const defaultProps = {
  disabled: false,
  searchString: '',
  withSearch: false,
}

function FeedbackSearchAndFilters({
  disabled,
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
}: Props) {
  const theme = useContext(ThemeContext)

  const sortLabels: Record<string, string> = {
    recency: 'Nach Zeitpunkt sortieren',
    votes: 'Nach Stimmen sortieren',
  }

  return (
    <div className="flex flex-col items-stretch justify-between mt-4 md:items-end md:flex-row print:hidden">
      <div className="flex flex-row items-center">
        {
          withSearch && 'INPUT'
          // <Input
          //   className="order-1 w-full md:mr-2 md:w-64 md:order-0"
          //   placeholder="Suche..."
          //   value={searchString}
          //   onChange={(e: any) => setSearchString(e.target.value)}
          // />
        }
        <div className="block mr-1 md:mr-0 xl:hidden order-0 md:order-1">
          <Dropdown
            trigger={
              <FontAwesomeIcon
                icon={faFilter}
                className={twMerge(
                  'p-2.5 border border-solid border-uzh-grey-60 rounded-md ml-2 shadow-md  hover:shadow-none',
                  `hover:${theme.primaryBg}`
                )}
              />
            }
            items={[
              {
                label: (
                  <span
                    className={twMerge(
                      'flex items-center hover:cursor-pointer px-2 py-0.5',
                      `hover:${theme.primaryBgDark}`
                    )}
                  >
                    <Checkbox checked={showResolved} onCheck={undefined} />
                    Gelöst
                  </span>
                ),
                onClick: () => setShowResolved((current: boolean) => !current),
              },
              {
                label: (
                  <span
                    className={twMerge(
                      'flex items-center hover:cursor-pointer px-2 py-0.5',
                      `hover:${theme.primaryBgDark}`
                    )}
                  >
                    <Checkbox checked={showOpen} onCheck={undefined} />
                    Offen
                  </span>
                ),
                onClick: () => setShowOpen((current: boolean) => !current),
              },
              {
                label: (
                  <span
                    className={twMerge(
                      'flex items-center hover:cursor-pointer px-2 py-0.5',
                      `hover:${theme.primaryBgDark}`
                    )}
                  >
                    <Checkbox checked={showUnpinned} onCheck={undefined} />
                    Ungepinnt
                  </span>
                ),
                onClick: () => setShowUnpinned((current: boolean) => !current),
              },
              {
                label: (
                  <span
                    className={twMerge(
                      'flex items-center hover:cursor-pointer px-2 py-0.5',
                      `hover:${theme.primaryBgDark}`
                    )}
                  >
                    <Checkbox checked={showUnpublished} onCheck={undefined} />
                    Unveröffentlicht
                  </span>
                ),
                onClick: () =>
                  setShowUnpublished((current: boolean) => !current),
              },
            ]}
          />
        </div>

        <div className="flex-row flex-wrap justify-between flex-initial order-1 hidden mt-4 mb-1 ml-4 xl:flex md:mt-0">
          <div className="inline-block">
            <span className="flex items-center">
              <Checkbox
                checked={showResolved}
                onCheck={() => setShowResolved((current: boolean) => !current)}
              />
              Gelöst
            </span>
          </div>

          <div className="inline-block">
            <span className="flex items-center">
              <Checkbox
                checked={showOpen}
                className="ml-4"
                onCheck={() => setShowOpen((current: boolean) => !current)}
              />
              Offen
            </span>
          </div>

          <div className="inline-block">
            <span className="flex items-center">
              <Checkbox
                checked={showUnpinned}
                className="ml-4"
                onCheck={() => setShowUnpinned((current: boolean) => !current)}
              />
              Ungepinnt
            </span>
          </div>

          <div className="inline-block">
            <span className="flex items-center">
              <Checkbox
                checked={showUnpublished}
                className="ml-4"
                onCheck={() =>
                  setShowUnpublished((current: boolean) => !current)
                }
              />
              Unveröffentlich
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-row">
        <Button
          className="justify-center mt-4 mr-2 w-11 h-11 md:mt-0"
          onClick={() => window.print()}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faPrint} />
          </Button.Icon>
        </Button>
        <Dropdown
          trigger={
            <span
              className={twMerge(
                'flex items-center hover:cursor-pointer px-1.5 py-2 border border-solid border-uzh-grey-60 rounded-md',
                `hover:${theme.primaryBgDark}`
              )}
            >
              <FontAwesomeIcon icon={faArrowUpShortWide} className="mr-2" />
              {sortLabels[sortBy]}
            </span>
          }
          items={[
            {
              label: 'Nach Zeitpunkt sortieren',
              onClick: () => setSortBy('recency'),
            },
            {
              label: 'Nach Stimmen sortieren',
              onClick: () => setSortBy('votes'),
            },
          ]}
        />
      </div>
    </div>
  )
}

FeedbackSearchAndFilters.defaultProps = defaultProps

export default FeedbackSearchAndFilters
