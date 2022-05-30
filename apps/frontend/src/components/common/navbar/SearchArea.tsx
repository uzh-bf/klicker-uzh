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
    <div className="flex flex-start">
      <Input
        fluid
        className="!flex-1 !mr-4"
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
            className="!leading-4 text-base"
            options={sortingTypes.map(({ content, id }): any => ({
              text: content,
              value: id,
            }))}
            value={sortBy}
            onChange={(_, data): void => handleSortByChange(data.value)}
          />
        </>
      )}
    </div>
  )
}

SearchArea.defaultProps = defaultProps

export default SearchArea
