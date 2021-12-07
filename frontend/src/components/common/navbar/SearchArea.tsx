import { defineMessages, useIntl } from 'react-intl'
import { Button, Dropdown, Input } from 'semantic-ui-react'
import _find from 'lodash/find'

const messages = defineMessages({
  searchPlaceholder: {
    defaultMessage: 'Search...',
    id: 'common.input.search.placeholder',
  },
})

interface Props {
  handleSearch: any
  handleSortByChange: any
  handleSortOrderToggle: any
  sortBy: string
  sortingTypes: {
    content: string
    id: string
    labelStart: string
  }[]
  sortOrder: boolean
  withSorting?: boolean
}

const defaultProps = {
  withSorting: false,
}

function SearchArea({
  handleSearch,
  handleSortByChange,
  handleSortOrderToggle,
  sortBy,
  sortingTypes,
  sortOrder,
  withSorting,
}: Props) {
  const intl = useIntl()
  return (
    <div className="searchArea">
      <Input
        fluid
        icon="search"
        placeholder={intl.formatMessage(messages.searchPlaceholder)}
        onChange={(e): void => handleSearch(e.target.value)}
      >
        <input />
      </Input>

      {withSorting && (
        <>
          <Button
            icon={`${(_find(sortingTypes, { id: sortBy }) || { labelStart: 'sort numeric' }).labelStart} ${
              sortOrder ? 'ascending' : 'descending'
            }`}
            size="small"
            onClick={handleSortOrderToggle}
          />
          <Dropdown
            selection
            options={sortingTypes.map(({ content, id }): any => ({
              text: content,
              value: id,
            }))}
            value={sortBy}
            onChange={(_, data): void => handleSortByChange(data.value)}
          />
        </>
      )}

      <style jsx>{`
        .searchArea {
          @import 'src/theme';

          display: flex;
          justify-content: flex-start;

          > :global(.input) {
            flex: 1;
            margin-right: 1rem;
          }

          :global(.dropdown),
          input {
            background-color: $color-primary-input;
            color: $color-primary-strong;
            line-height: 1rem;
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  )
}

SearchArea.defaultProps = defaultProps

export default SearchArea
