import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Button, Input } from 'semantic-ui-react'
import { compose, withHandlers, withState } from 'recompose'

const propTypes = {
  handleSearch: PropTypes.func.isRequired,
  handleSortOrderChange: PropTypes.func.isRequired,
  handleSortTypeChange: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const sortingTypes = [
  { content: 'Title', id: 'TITLE' },
  { content: 'Number of votes', id: 'VOTES' },
  { content: 'Question Type', id: 'TYPE' },
  { content: 'Created at', id: 'CREATED' },
]

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
    <Button.Group>
      <Button icon="sort alphabet ascending" />
      <Button content={sortingTypes[0].content} />
    </Button.Group>

    <style jsx>{`
      .searchingArea {
        display: flex;
        justify-content: flex-start;
      }

      .searchingArea > :global(.input) {
        flex: 1;
      }

      .searchingArea > :global(.buttons) {
        width: 10rem;
      }
    `}</style>
  </div>
)

SearchArea.propTypes = propTypes

export default compose(
  withState('sortType', 'setSortType', sortingTypes[0].id),
  withState('sortOrder', 'setSortOrder', 1), // sortOrder can either be ASC (1) or DESC (0)
  withHandlers({
    handleSortTypeChange: ({ setSortType }) => newSortType =>
      setSortType({ sortType: newSortType }),
    handleSortOrderChange: ({ setSortOrder }) => () => setSortOrder(sortOrder => !sortOrder),
  }),
)(SearchArea)
