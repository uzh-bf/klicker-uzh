import React from 'react'
import PropTypes from 'prop-types'
import { Input, Menu } from 'semantic-ui-react'

const SearchArea = ({ handleSearch, intl }) =>
  (<Menu.Item fitted className="searchArea">
    <Input
      className="searchField"
      icon="search"
      placeholder={intl.formatMessage({
        defaultMessage: 'Search...',
        id: 'common.input.search.placeholder',
      })}
      onChange={handleSearch}
    />
  </Menu.Item>)

SearchArea.propTypes = {
  handleSearch: PropTypes.func.isRequired,
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
}

export default SearchArea
