import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Button, Input } from 'semantic-ui-react'
import { compose, withHandlers, withState } from 'recompose'
import _findIndex from 'lodash/findIndex'
import _find from 'lodash/find'

const propTypes = {
  handleSearch: PropTypes.func.isRequired,
  handleSortOrderChange: PropTypes.func.isRequired,
  handleSortTypeChange: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  sortType: PropTypes.string.isRequired,
}

const sortingTypes = [
  { content: 'Title', id: 'TITLE' },
  { content: 'Number of votes', id: 'VOTES' },
  { content: 'Question Type', id: 'TYPE' },
  { content: 'Created at', id: 'CREATED' },
]

const SearchArea = ({
  intl, handleSearch, handleSortTypeChange, sortType,
}) => (
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
      <Button
        content={_find(sortingTypes, { id: sortType }).content}
        onClick={() => handleSortTypeChange(sortType)}
      />
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
    handleSortTypeChange: ({ setSortType }) => (currentSortType) => {
      // find current value and set next value in array as current sortType
      const currentIndex = _findIndex(sortingTypes, { id: currentSortType })
      let nextIndex = currentIndex + 1
      if (nextIndex === sortingTypes.length) nextIndex = 0
      const nextObject = sortingTypes[nextIndex]
      setSortType(nextObject.id)
    },
    handleSortOrderChange: ({ setSortOrder }) => () => setSortOrder(sortOrder => !sortOrder),
  }),
)(SearchArea)
