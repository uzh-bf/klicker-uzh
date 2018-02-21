import { compose, withStateHandlers } from 'recompose'

import { QUESTION_SORTINGS } from '../constants'

export default (ComposedComponent) => {
  const withSortingAndFiltering = compose(
    withStateHandlers(
      {
        filters: {
          tags: [],
          title: null,
          type: null,
        },
        sort: {
          asc: true,
          by: QUESTION_SORTINGS[0].id,
        },
      },
      {
        // handle an update in the search bar
        handleSearch: ({ filters }) => title => ({ filters: { ...filters, title } }),

        // handle updated sort settings
        handleSortByChange: ({ sort }) => by => ({ sort: { ...sort, by } }),
        handleSortOrderToggle: ({ sort }) => () => ({ sort: { ...sort, asc: !sort.asc } }),

        // handle clicking on a tag in the tag list
        handleTagClick: ({ filters }) => (tagName, questionType = false) => {
          // if the changed tag is a question type tag
          if (questionType) {
            if (filters.type === tagName) {
              return { filters: { ...filters, type: null } }
            }

            // add the tag to active tags
            return { filters: { ...filters, type: tagName } }
          }

          // remove the tag from active tags
          if (filters.tags.includes(tagName)) {
            return {
              filters: {
                ...filters,
                tags: filters.tags.filter(tag => tag !== tagName),
              },
            }
          }

          // add the tag to active tags
          return {
            filters: {
              ...filters,
              tags: [...filters.tags, tagName],
            },
          }
        },
      },
    ),
  )(ComposedComponent)

  withSortingAndFiltering.displayName = `withSortingAndFiltering(${ComposedComponent.displayName ||
    ComposedComponent.name})`

  return withSortingAndFiltering
}
