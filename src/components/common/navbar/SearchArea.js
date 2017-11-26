import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Button, Input } from 'semantic-ui-react'

const propTypes = {
  handleSearch: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const SearchArea = ({ intl, handleSearch }) => (
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
    <Button content={'Hello'} />

    <style jsx>{`
      .searchingArea {
        display: flex;
        justify-content: flex-start;
      }

      .searchingArea > :global(.input) {
        flex: 1;
      }

      .searchingArea > :global(.button) {
        width: 15rem;
      }
    `}</style>
  </div>
)

SearchArea.propTypes = propTypes

export default SearchArea
