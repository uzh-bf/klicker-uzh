import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Input } from 'semantic-ui-react'

const propTypes = {
  handleSearch: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const SearchArea = ({ intl, handleSearch }) => (
  <Input
    fluid
    icon="search"
    placeholder={intl.formatMessage({
      defaultMessage: 'Search...',
      id: 'common.input.search.placeholder',
    })}
    onChange={e => handleSearch(e.target.value)}
  />
)

SearchArea.propTypes = propTypes

export default SearchArea
