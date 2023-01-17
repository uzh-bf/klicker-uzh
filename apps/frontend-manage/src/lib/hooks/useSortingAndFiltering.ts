// TODO: typing

import { useReducer } from 'react'

import { QUESTION_SORTINGS } from 'shared-components/src/constants'

const INITIAL_STATE = {
  filters: {
    archive: false,
    tags: [],
    title: null,
    type: null,
    sampleSolution: null,
    answerFeedbacks: null,
  },
  sort: {
    asc: false,
    by: QUESTION_SORTINGS[0].id,
  },
}

function reducer(state, action): any {
  switch (action.type) {
    case 'TAG_CLICK':
      // if the changed tag is a question type tag
      if (action.questionType) {
        if (state.filters.type === action.tagName) {
          return { ...state, filters: { ...state.filters, type: null } }
        }

        // add the tag to active tags
        return { ...state, filters: { ...state.filters, type: action.tagName } }
      }

      // remove the tag from active tags
      if (state.filters.tags.includes(action.tagName)) {
        return {
          ...state,
          filters: {
            ...state.filters,
            tags: state.filters.tags.filter(
              (tag): boolean => tag !== action.tagName
            ),
          },
        }
      }

      // add the tag to active tags
      return {
        ...state,
        filters: {
          ...state.filters,
          tags: [...state.filters.tags, action.tagName],
        },
      }

    case 'TOGGLE_ARCHIVE':
      return {
        ...state,
        filters: {
          ...state.filters,
          archive:
            typeof action.newValue !== 'undefined'
              ? action.newValue
              : !state.filters.archive,
        },
      }

    case 'SORT_ORDER':
      return {
        ...state,
        sort: {
          ...state.sort,
          asc: !state.sort.asc,
        },
      }

    case 'SORT_BY':
      return {
        ...state,
        sort: {
          ...state.sort,
          by: action.by,
        },
      }

    case 'SEARCH':
      return {
        ...state,
        filters: {
          ...state.filters,
          title: action.title,
        },
      }

    case 'SAMPLE_SOLUTION':
      return {
        ...state,
        filters: {
          ...state.filters,
          sampleSolution:
            typeof action.newValue !== 'undefined'
              ? action.newValue
              : !state.filters.sampleSolution,
        },
      }

    case 'ANSWER_FEEDBACKS':
      return {
        ...state,
        filters: {
          ...state.filters,
          answerFeedbacks:
            typeof action.newValue !== 'undefined'
              ? action.newValue
              : !state.filters.answerFeedbacks,
        },
      }

    case 'RESET':
      return { ...state, filters: INITIAL_STATE.filters }

    default:
      return state
  }
}

function useSortingAndFiltering(): any {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  return {
    ...state,
    handleReset: (): void => dispatch({ type: 'RESET' }),
    handleSearch: (title: string): void => dispatch({ type: 'SEARCH', title }),
    handleSortByChange: (by): void => dispatch({ type: 'SORT_BY', by }),
    handleSortOrderToggle: (): void => dispatch({ type: 'SORT_ORDER' }),
    handleToggleArchive: (newValue: boolean): void =>
      dispatch({ type: 'TOGGLE_ARCHIVE', newValue }),
    handleTagClick: (tagName: string, questionType): void =>
      dispatch({ type: 'TAG_CLICK', tagName, questionType }),
    handleSampleSolutionClick: (newValue: boolean): void =>
      dispatch({ type: 'SAMPLE_SOLUTION', newValue }),
    handleAnswerFeedbacksClick: (newValue: boolean): void =>
      dispatch({ type: 'ANSWER_FEEDBACKS', newValue }),
  }
}

export default useSortingAndFiltering
