import { Input, Checkbox, Button, Dropdown } from 'semantic-ui-react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'

const messages = defineMessages({
  searchPlaceholder: {
    id: 'runningSession.search.placeholder',
    defaultMessage: 'Search...',
  },
})

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
  const intl = useIntl()
  return (
    <div className="flex flex-col items-stretch justify-between mt-4 md:items-end md:flex-row print:hidden">
      <div className="flex flex-row items-center">
        {withSearch && (
          <Input
            className="order-1 w-full md:mr-2 md:w-64 md:order-0"
            placeholder={intl.formatMessage(messages.searchPlaceholder)}
            value={searchString}
            onChange={(e) => setSearchString(e.target.value)}
          />
        )}
        <div className="block mr-1 md:mr-0 2xl:hidden order-0 md:order-1">
          <Dropdown basic className="!h-11 !w-11 !pl-4 !pt-3.5" icon="filter" button>
            <Dropdown.Menu direction="right">
              <Dropdown.Header>Feedback Filter</Dropdown.Header>
              <Dropdown.Item>
                <span className="flex items-center">
                  <Checkbox checked={showResolved} label="" onChange={() => setShowResolved((current) => !current)} />
                  <FormattedMessage defaultMessage="Resolved" id="runningSession.checkboxes.resolved" />
                </span>
              </Dropdown.Item>
              <Dropdown.Item>
                <span className="flex items-center">
                  <Checkbox checked={showOpen} label="" onChange={() => setShowOpen((current) => !current)} />
                  <FormattedMessage defaultMessage="Open" id="runningSession.checkboxes.open" />
                </span>
              </Dropdown.Item>
              <Dropdown.Item>
                <span className="flex items-center">
                  <Checkbox checked={showUnpinned} label="" onChange={() => setShowUnpinned((current) => !current)} />
                  <FormattedMessage defaultMessage="Unpinned" id="runningSession.checkboxes.unpinned" />
                </span>
              </Dropdown.Item>
              <Dropdown.Item>
                <span className="flex items-center">
                  <Checkbox
                    checked={showUnpublished}
                    label=""
                    onChange={() => setShowUnpublished((current) => !current)}
                  />
                  <FormattedMessage defaultMessage="Unpublished" id="runningSession.checkboxes.unpublished" />
                </span>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>

        <div className="flex-row flex-wrap justify-between flex-initial order-1 hidden mt-4 mb-1 ml-4 2xl:flex md:mt-0">
          <div className="inline-block">
            <span className="flex items-center">
              <Checkbox checked={showResolved} label="" onChange={() => setShowResolved((current) => !current)} />
              <FormattedMessage defaultMessage="Resolved" id="runningSession.checkboxes.resolved" />
            </span>
          </div>

          <div className="inline-block">
            <span className="flex items-center">
              <Checkbox
                checked={showOpen}
                className="ml-4"
                label=""
                onChange={() => setShowOpen((current) => !current)}
              />
              <FormattedMessage defaultMessage="Open" id="runningSession.checkboxes.open" />
            </span>
          </div>

          <div className="inline-block">
            <span className="flex items-center">
              <Checkbox
                checked={showUnpinned}
                className="ml-4"
                label=""
                onChange={() => setShowUnpinned((current) => !current)}
              />
              <FormattedMessage defaultMessage="Unpinned" id="runningSession.checkboxes.unpinned" />
            </span>
          </div>

          <div className="inline-block">
            <span className="flex items-center">
              <Checkbox
                checked={showUnpublished}
                className="ml-4"
                label=""
                onChange={() => setShowUnpublished((current) => !current)}
              />
              <FormattedMessage defaultMessage="Unpublished" id="runningSession.checkboxes.unpublished" />
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-row">
        <Button basic className="!mt-4 md:!mt-0 !mr-2" icon="print" onClick={() => window.print()} />
        <Dropdown
          selection
          className="flex flex-1 mt-4 md:mt-0"
          disabled={disabled}
          options={[
            {
              text: <FormattedMessage defaultMessage="Sort by Recency" id="runningSession.sorting.recency" />,
              value: 'recency',
            },
            {
              text: <FormattedMessage defaultMessage="Sort by Upvotes" id="runningSession.sorting.upvotes" />,
              value: 'votes',
            },
          ]}
          value={sortBy}
          onChange={(_, { value }) => setSortBy(String(value))}
        />
      </div>
    </div>
  )
}

FeedbackSearchAndFilters.defaultProps = defaultProps

export default FeedbackSearchAndFilters
