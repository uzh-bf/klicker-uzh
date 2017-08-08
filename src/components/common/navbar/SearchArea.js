// @flow

import React from 'react'
import { Input } from 'semantic-ui-react'

type Props = {
  handleSearch: () => mixed,
  intl: $IntlShape,
}

const SearchArea = ({ handleSearch, intl }: Props) =>
  (<Input
    fluid
    icon="search"
    placeholder={intl.formatMessage({
      defaultMessage: 'Search...',
      id: 'common.input.search.placeholder',
    })}
    onChange={handleSearch}
  />)

export default SearchArea
