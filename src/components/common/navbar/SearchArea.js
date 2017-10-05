import React from 'react'
import { Input } from 'semantic-ui-react'

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

export default SearchArea
