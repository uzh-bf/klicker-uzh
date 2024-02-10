import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { useReducer } from 'react'

export type QuestionPoolFilterType = {
  archive: boolean
  tags: string[]
  name: string | null
  type?: string | null
  sampleSolution: boolean | null
  answerFeedbacks: boolean | null
}

type SortType = {
  asc: boolean
  by: string
}

type FilterSortType = {
  filters: QuestionPoolFilterType
  sort: SortType
}

type ReducerAction = {
  type: QuestionPoolReducerActionType
  tagName?: string
  questionType?: ElementType
  newValue?: boolean
  name?: string
  by?: string
}

export enum QuestionPoolReducerActionType {
  TAG_CLICK = 'TAG_CLICK',
  TOGGLE_ARCHIVE = 'TOGGLE_ARCHIVE',
  SORT_ORDER = 'SORT_ORDER',
  SORT_BY = 'SORT_BY',
  SEARCH = 'SEARCH',
  SAMPLE_SOLUTION = 'SAMPLE_SOLUTION',
  ANSWER_FEEDBACKS = 'ANSWER_FEEDBACKS',
  RESET = 'RESET',
  UNDEFINED = 'UNDEFINED',
}

const INITIAL_STATE: FilterSortType = {
  filters: {
    type: QuestionPoolReducerActionType.UNDEFINED,
    archive: false,
    tags: [],
    name: null,
    sampleSolution: null,
    answerFeedbacks: null,
  },
  sort: {
    asc: false,
    by: '',
  },
}

function reducer(state: FilterSortType, action: ReducerAction): FilterSortType {
  switch (action.type) {
    case QuestionPoolReducerActionType.TAG_CLICK:
      // if the changed tag is a question type tag
      if (action.questionType) {
        if (state.filters.type === action.tagName) {
          return { ...state, filters: { ...state.filters, type: null } }
        }

        // add the tag to active tags
        return { ...state, filters: { ...state.filters, type: action.tagName } }
      }

      // remove the tag from active tags
      if (action.tagName && state.filters.tags.includes(action.tagName)) {
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
          tags: [...state.filters.tags, action.tagName!],
        },
      }

    case QuestionPoolReducerActionType.TOGGLE_ARCHIVE:
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

    case QuestionPoolReducerActionType.SORT_ORDER:
      return {
        ...state,
        sort: {
          ...state.sort,
          asc: !state.sort.asc,
        },
      }

    case QuestionPoolReducerActionType.SORT_BY:
      return {
        ...state,
        sort: {
          ...state.sort,
          by: action.by!,
        },
      }

    case QuestionPoolReducerActionType.SEARCH:
      return {
        ...state,
        filters: {
          ...state.filters,
          name: action.name!,
        },
      }

    case QuestionPoolReducerActionType.SAMPLE_SOLUTION:
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

    case QuestionPoolReducerActionType.ANSWER_FEEDBACKS:
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

    case QuestionPoolReducerActionType.RESET:
      return { ...state, filters: INITIAL_STATE.filters }

    default:
      return state
  }
}

function useSortingAndFiltering() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  return {
    ...state,
    handleReset: (): void =>
      dispatch({ type: QuestionPoolReducerActionType.RESET }),
    handleSearch: (name: string): void =>
      dispatch({ type: QuestionPoolReducerActionType.SEARCH, name }),
    handleSortByChange: (by: string): void =>
      dispatch({ type: QuestionPoolReducerActionType.SORT_BY, by }),
    handleSortOrderToggle: (): void =>
      dispatch({ type: QuestionPoolReducerActionType.SORT_ORDER }),
    handleToggleArchive: (newValue: boolean): void =>
      dispatch({
        type: QuestionPoolReducerActionType.TOGGLE_ARCHIVE,
        newValue,
      }),
    handleTagClick: (tagName: string, questionType: ElementType): void =>
      dispatch({
        type: QuestionPoolReducerActionType.TAG_CLICK,
        tagName,
        questionType,
      }),
    handleSampleSolutionClick: (newValue: boolean): void =>
      dispatch({
        type: QuestionPoolReducerActionType.SAMPLE_SOLUTION,
        newValue,
      }),
    handleAnswerFeedbacksClick: (newValue: boolean): void =>
      dispatch({
        type: QuestionPoolReducerActionType.ANSWER_FEEDBACKS,
        newValue,
      }),
  }
}

export default useSortingAndFiltering
