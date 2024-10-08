import { ElementStatus, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { useReducer } from 'react'

export type QuestionPoolFilters = {
  archive: boolean
  untagged: boolean
  tags: string[]
  name: string | null
  status?: ElementStatus
  type?: ElementType
  sampleSolution: boolean
  answerFeedbacks: boolean
}

export type QuestionPoolSortType = {
  asc: boolean
  by: SortyByType
}

export enum SortyByType {
  TITLE = 'TITLE',
  TYPE = 'TYPE',
  CREATED = 'CREATED',
  MODIFIED = 'MODIFIED',
  USED = 'USED',
  UNDEFINED = 'UNDEFINED',
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

type FilterSortType = {
  filters: QuestionPoolFilters
  sort: QuestionPoolSortType
}

type ReducerAction = {
  type: QuestionPoolReducerActionType
  tagName?: ElementType | ElementStatus | string
  isTypeTag?: boolean
  isStatusTag?: boolean
  isUntagged?: boolean
  newValue?: boolean
  name?: string
  by?: SortyByType
}

const INITIAL_STATE: FilterSortType = {
  filters: {
    status: undefined,
    type: undefined,
    archive: false,
    untagged: false,
    tags: [],
    name: null,
    sampleSolution: false,
    answerFeedbacks: false,
  },
  sort: {
    asc: false,
    by: SortyByType.UNDEFINED,
  },
}

function reducer(state: FilterSortType, action: ReducerAction): FilterSortType {
  console.log(state, action)

  switch (action.type) {
    case QuestionPoolReducerActionType.TAG_CLICK:
      // if the changed tag is untagged
      if (action.isUntagged) {
        return {
          ...state,
          filters: {
            ...state.filters,
            tags: [],
            untagged: !state.filters.untagged,
          },
        }
      }

      // if the changed tag is a question type tag
      if (action.isTypeTag) {
        if (state.filters.type === action.tagName) {
          return { ...state, filters: { ...state.filters, type: undefined } }
        }

        // add the tag to active tags
        return {
          ...state,
          filters: { ...state.filters, type: action.tagName as ElementType },
        }
      }

      // if the changed tag is a question status tag
      if (action.isStatusTag) {
        if (state.filters.status === action.tagName) {
          return { ...state, filters: { ...state.filters, status: undefined } }
        }

        // add the tag to active tags
        return {
          ...state,
          filters: {
            ...state.filters,
            status: action.tagName as ElementStatus,
          },
        }
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
          untagged: false,
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
    handleSortByChange: (by: SortyByType): void =>
      dispatch({ type: QuestionPoolReducerActionType.SORT_BY, by }),
    handleSortOrderToggle: (): void =>
      dispatch({ type: QuestionPoolReducerActionType.SORT_ORDER }),
    handleToggleArchive: (): void =>
      dispatch({
        type: QuestionPoolReducerActionType.TOGGLE_ARCHIVE,
        newValue: !state.filters.archive,
      }),
    handleTagClick: ({
      tagName,
      isTypeTag,
      isStatusTag,
      isUntagged,
    }: {
      tagName: string
      isTypeTag: boolean
      isStatusTag: boolean
      isUntagged: boolean
    }): void =>
      dispatch({
        type: QuestionPoolReducerActionType.TAG_CLICK,
        tagName,
        isTypeTag,
        isStatusTag,
        isUntagged,
      }),
    toggleSampleSolutionFilter: (): void =>
      dispatch({
        type: QuestionPoolReducerActionType.SAMPLE_SOLUTION,
        newValue: !state.filters.sampleSolution,
      }),
    toggleAnswerFeedbackFilter: (): void =>
      dispatch({
        type: QuestionPoolReducerActionType.ANSWER_FEEDBACKS,
        newValue: !state.filters.answerFeedbacks,
      }),
  }
}

export default useSortingAndFiltering
