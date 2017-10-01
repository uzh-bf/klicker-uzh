// @flow

import * as React from 'react'
import { Input } from 'semantic-ui-react'

type Props = {
  intl: any,
  handleSearch: (query: string) => mixed,
}

const SearchArea = ({ intl, handleSearch }: Props) => (
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
