import React from 'react'
import PropTypes from 'prop-types'
import { Input } from 'semantic-ui-react'

const SearchArea = ({ handleSearch, intl }) =>
  (<Input
    fluid
    icon="search"
    placeholder={intl.formatMessage({
      defaultMessage: 'Search...',
      id: 'common.input.search.placeholder',
    })}
    onChange={handleSearch}
  />)

SearchArea.propTypes = {
  handleSearch: PropTypes.func.isRequired,
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
}

export default SearchArea
