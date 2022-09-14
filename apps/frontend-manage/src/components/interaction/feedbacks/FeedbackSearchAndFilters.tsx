// TODO: eliminate duplicated content and imporve layout instead dynamically

import { faPrint } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
// import { Checkbox, Dropdown, Input } from 'semantic-ui-react'

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
  return (
    <div className="flex flex-col items-stretch justify-between mt-4 md:items-end md:flex-row print:hidden">
      <div className="flex flex-row items-center">
        {withSearch &&
          'INPUT'
          // <Input
          //   className="order-1 w-full md:mr-2 md:w-64 md:order-0"
          //   placeholder="Suche..."
          //   value={searchString}
          //   onChange={(e: any) => setSearchString(e.target.value)}
          // />
        }
        <div className="block mr-1 md:mr-0 2xl:hidden order-0 md:order-1">
          {/* <Dropdown basic button className="!h-11 !w-11 !pl-4 !pt-3.5" icon="filter">
            <Dropdown.Menu direction="right">
              <Dropdown.Header>Feedback Filter</Dropdown.Header>
              <Dropdown.Item>
                <span className="flex items-center">
                  <Checkbox checked={showResolved} label="" onChange={() => setShowResolved((current) => !current)} />
                  Gelöst
                </span>
              </Dropdown.Item>
              <Dropdown.Item>
                <span className="flex items-center">
                  <Checkbox checked={showOpen} label="" onChange={() => setShowOpen((current) => !current)} />
                  Offen
                </span>
              </Dropdown.Item>
              <Dropdown.Item>
                <span className="flex items-center">
                  <Checkbox checked={showUnpinned} label="" onChange={() => setShowUnpinned((current) => !current)} />
                  Ungepinnt
                </span>
              </Dropdown.Item>
              <Dropdown.Item>
                <span className="flex items-center">
                  <Checkbox
                    checked={showUnpublished}
                    label=""
                    onChange={() => setShowUnpublished((current) => !current)}
                  />
                  Unveröffentlicht
                </span>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown> */}
        </div>

        <div className="flex-row flex-wrap justify-between flex-initial order-1 hidden mt-4 mb-1 ml-4 2xl:flex md:mt-0">
          <div className="inline-block">
            <span className="flex items-center">
              {/* <Checkbox checked={showResolved} label="" onChange={() => setShowResolved((current) => !current)} /> */}
              Gelöst
            </span>
          </div>

          <div className="inline-block">
            <span className="flex items-center">
              {/* <Checkbox
                checked={showOpen}
                className="ml-4"
                label=""
                onChange={() => setShowOpen((current) => !current)}
              /> */}
              Offen
            </span>
          </div>

          <div className="inline-block">
            <span className="flex items-center">
              {/* <Checkbox
                checked={showUnpinned}
                className="ml-4"
                label=""
                onChange={() => setShowUnpinned((current) => !current)}
              /> */}
              Ungepinnt
            </span>
          </div>

          <div className="inline-block">
            <span className="flex items-center">
              {/* <Checkbox
                checked={showUnpublished}
                className="ml-4"
                label=""
                onChange={() => setShowUnpublished((current) => !current)}
              /> */}
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
        {/* <Dropdown
          selection
          className="flex flex-1 mt-4 md:mt-0"
          disabled={disabled}
          options={[
            {
              text: "Nach Zeitpunkt sortieren",
              value: 'recency',
            },
            {
              text: "Nach Stimmen sortieren",
              value: 'votes',
            },
          ]}
          value={sortBy}
          onChange={(_, { value }) => setSortBy(String(value))}
        /> */}
      </div>
    </div>
  )
}

FeedbackSearchAndFilters.defaultProps = defaultProps

export default FeedbackSearchAndFilters
