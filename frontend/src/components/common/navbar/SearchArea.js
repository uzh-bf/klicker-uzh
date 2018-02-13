import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Input } from 'semantic-ui-react'

const propTypes = {
  handleSearch: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const SearchArea = ({ intl, handleSearch }) => (
  <div className="searchWrapper">
    <Input
      fluid
      icon="search"
      placeholder={intl.formatMessage({
        defaultMessage: 'Search...',
        id: 'common.input.search.placeholder',
      })}
      onChange={e => handleSearch(e.target.value)}
    />
    {/* TODO: <div className="filters">
      {filters.tags.length > 0 && filters.tags.map(tag => <span className="tag">{tag}</span>)}
    </div> */}

    <style jsx>{`
      .searchWrapper {
        position: relative;

        .filters {
          position: absolute;
          bottom: 0.65rem;
          right: 3rem;

          .tag {
            font-style: italic;
            margin-left: 0.5rem;
          }
        }
      }
    `}</style>
  </div>
)

SearchArea.propTypes = propTypes

export default SearchArea
