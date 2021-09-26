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
      <div className="flex flex-col items-end md:flex-row">
        {withSearch && (
          <Input
            className="w-full md:w-96 md:mr-8"
            placeholder={intl.formatMessage(messages.searchPlaceholder)}
            value={searchString}
            onChange={(e) => setSearchString(e.target.value)}
          />
        )}
        <div className="flex flex-row justify-between flex-initial mt-4 mb-1 md:mt-0">
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
        <Button basic className="!mr-2" icon="print" onClick={() => window.print()} />
        <Dropdown
          selection
          className="mt-4 md:mt-0"
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
