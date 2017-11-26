import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Button, Input } from 'semantic-ui-react'
import _find from 'lodash/find'

const propTypes = {
  handleSearch: PropTypes.func.isRequired,
  handleSortByChange: PropTypes.func.isRequired,
  handleSortOrderChange: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  sortBy: PropTypes.bool.isRequired,
  sortingTypes: PropTypes.shape({
    content: PropTypes.string,
    id: PropTypes.string,
    labelStart: PropTypes.string,
  }).isRequired,
  sortOrder: PropTypes.string.isRequired,
}

const SearchArea = ({
  intl,
  handleSearch,
  handleSortByChange,
  handleSortOrderChange,
  sortBy,
  sortingTypes,
  sortOrder,
}) => (
  <div className="searchingArea">
    <Input
      fluid
      icon="search"
      placeholder={intl.formatMessage({
        defaultMessage: 'Search...',
        id: 'common.input.search.placeholder',
      })}
      onChange={e => handleSearch(e.target.value)}
    />
    <Button.Group>
      <Button
        icon={`${_find(sortingTypes, { id: sortBy }).labelStart} ${
          sortOrder ? 'ascending' : 'descending'
        }`}
        onClick={handleSortOrderChange}
      />
      <Button
        content={_find(sortingTypes, { id: sortBy }).content}
        onClick={() => handleSortByChange(sortBy)}
      />
    </Button.Group>

    <style jsx>{`
      .searchingArea {
        display: flex;
        justify-content: flex-start;
      }

      .searchingArea > :global(.input) {
        flex: 1;
      }

      .searchingArea > :global(.buttons) {
        width: 10rem;
      }
    `}</style>
  </div>
)

SearchArea.propTypes = propTypes

export default SearchArea
