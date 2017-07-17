import React from 'react'
import PropTypes from 'prop-types'
import { Input, Menu } from 'semantic-ui-react'

const SearchArea = ({ intl, handleSearch }) =>
  (<Menu.Item fitted className="searchArea">
    <Input
      className="searchField"
      icon="search"
      placeholder={intl.formatMessage({
        id: 'common.input.search.placeholder',
        defaultMessage: 'Search...',
      })}
      onChange={handleSearch}
    />
  </Menu.Item>)

SearchArea.propTypes = {
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
  handleSearch: PropTypes.func.isRequired,
}

export default SearchArea
