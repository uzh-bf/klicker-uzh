import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Button, Dropdown, Input } from 'semantic-ui-react'
import _find from 'lodash/find'

const propTypes = {
  handleSearch: PropTypes.func.isRequired,
  handleSortByChange: PropTypes.func.isRequired,
  handleSortOrderToggle: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  sortBy: PropTypes.string.isRequired,
  sortingTypes: PropTypes.arrayOf(
    PropTypes.shape({
      content: PropTypes.string,
      id: PropTypes.string,
      labelStart: PropTypes.string,
    }),
  ).isRequired,
  sortOrder: PropTypes.bool.isRequired,
  withSorting: PropTypes.bool,
}

const defaultProps = {
  withSorting: false,
}

const SearchArea = ({
  intl,
  handleSearch,
  handleSortByChange,
  handleSortOrderToggle,
  sortBy,
  sortingTypes,
  sortOrder,
  withSorting,
}) => (
  <div className="searchArea">
    <Input
      fluid
      icon="search"
      placeholder={intl.formatMessage({
        defaultMessage: 'Search...',
        id: 'common.input.search.placeholder',
      })}
      onChange={e => handleSearch(e.target.value)}
    >
      <input />
    </Input>

    {withSorting && (
      <React.Fragment>
        <Button
          icon={`${_find(sortingTypes, { id: sortBy }).labelStart} ${
            sortOrder ? 'ascending' : 'descending'
          }`}
          size="small"
          onClick={handleSortOrderToggle}
        />
        <Dropdown
          selection
          options={sortingTypes.map(({ content, id }) => ({ text: content, value: id }))}
          onChange={(param, data) => handleSortByChange(data.value)}
        />
      </React.Fragment>
    )}

    <style jsx>{`
      .searchArea {
        display: flex;
        justify-content: flex-start;

        > :global(.input) {
          flex: 1;
          margin-right: 1rem;
        }
      }
    `}</style>
  </div>
)

SearchArea.propTypes = propTypes
SearchArea.defaultProps = defaultProps

export default SearchArea
