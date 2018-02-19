import _findIndex from 'lodash/findIndex'
import { compose, withStateHandlers } from 'recompose'

import { QUESTION_SORTINGS } from '../constants'

export default (ComposedComponent) => {
  const WithSorting = compose(
    withStateHandlers(
      {
        sort: {
          asc: true,
          by: QUESTION_SORTINGS[0].id,
        },
      },
      {
        // handle updated sort settings
        handleSortByChange: ({ sort }) => (currentSortBy) => {
          console.log(sort, currentSortBy)

          // find current value and set next value in array as current sortType
          const currentIndex = _findIndex(QUESTION_SORTINGS, { id: currentSortBy })
          let nextIndex = currentIndex + 1
          if (nextIndex === QUESTION_SORTINGS.length) nextIndex = 0
          const nextObject = QUESTION_SORTINGS[nextIndex]

          return { sort: { ...sort, by: nextObject.id } }
        },
        handleSortOrderToggle: ({ sort }) => () => {
          console.log(sort)
          return { sort: { ...sort, asc: !sort.asc } }
        },
      },
    ),
  )(ComposedComponent)

  WithSorting.displayName = `WithSorting(${ComposedComponent.displayName ||
    ComposedComponent.name})`

  return WithSorting
}
