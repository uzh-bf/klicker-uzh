import {
  ElementStatus,
  ElementType,
  SharingType,
  SortByType,
} from '@klicker-uzh/graphql/dist/ops'
import { useCallback, useReducer } from 'react'

export type LibraryFilters = {
  archive: boolean
  untagged: boolean
  tags: string[]
  sharingType: SharingType[]
  status?: ElementStatus
  type?: ElementType
  courseId?: string
  activityId?: string
  multiplier?: number
  sampleSolution: boolean
  answerFeedbacks: boolean
}

export type LibrarySortType = {
  asc: boolean
  by: SortByType
}

enum QuestionPoolReducerActionType {
  TAG_CLICK = 'TAG_CLICK',
  TOGGLE_ARCHIVE = 'TOGGLE_ARCHIVE',
  SORT_ORDER = 'SORT_ORDER',
  SORT_BY = 'SORT_BY',
  SAMPLE_SOLUTION = 'SAMPLE_SOLUTION',
  ANSWER_FEEDBACKS = 'ANSWER_FEEDBACKS',
  RESET = 'RESET',
  UNDEFINED = 'UNDEFINED',
  SET_COURSE_ID = 'SET_COURSE_ID',
  SET_ACTIVITY_ID = 'SET_ACTIVITY_ID',
  SET_MULTIPLIER = 'SET_MULTIPLIER',
}

type FilterSortType = {
  filters: LibraryFilters
  sort: LibrarySortType
}

type ReducerAction = {
  type: QuestionPoolReducerActionType
  valueOrId?: ElementType | ElementStatus | string
  isTypeTag?: boolean
  isStatusTag?: boolean
  isSharingTypeTag?: boolean
  isUntagged?: boolean
  newValue?: boolean
  name?: string
  multiplier?: number
  by?: SortByType
}

export const SORTING_FILTERING_INITIAL: FilterSortType = {
  filters: {
    status: undefined,
    type: undefined,
    sharingType: [
      SharingType.Owned,
      SharingType.Shared,
      SharingType.Dependency,
    ],
    archive: false,
    untagged: false,
    tags: [],
    courseId: undefined,
    activityId: undefined,
    multiplier: undefined,
    sampleSolution: false,
    answerFeedbacks: false,
  },
  sort: {
    asc: false,
    by: SortByType.Modified,
  },
}

function reducer(state: FilterSortType, action: ReducerAction): FilterSortType {
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
        if (state.filters.type === action.valueOrId) {
          return { ...state, filters: { ...state.filters, type: undefined } }
        }

        // add the tag to active tags
        return {
          ...state,
          filters: { ...state.filters, type: action.valueOrId as ElementType },
        }
      }

      // if the changed tag is a question status tag
      if (action.isStatusTag) {
        if (state.filters.status === action.valueOrId) {
          return { ...state, filters: { ...state.filters, status: undefined } }
        }

        // add the tag to active tags
        return {
          ...state,
          filters: {
            ...state.filters,
            status: action.valueOrId as ElementStatus,
          },
        }
      }

      // if the sharing type was modified
      if (action.isSharingTypeTag) {
        return {
          ...state,
          filters: {
            ...state.filters,
            sharingType: state.filters.sharingType.includes(
              action.valueOrId as SharingType
            )
              ? state.filters.sharingType.filter(
                  (type): boolean => type !== action.valueOrId
                )
              : [...state.filters.sharingType, action.valueOrId as SharingType],
          },
        }
      }

      // remove the tag from active tags
      if (action.valueOrId && state.filters.tags.includes(action.valueOrId)) {
        return {
          ...state,
          filters: {
            ...state.filters,
            tags: state.filters.tags.filter(
              (tag): boolean => tag !== action.valueOrId
            ),
          },
        }
      }

      // add the tag to active tags
      return {
        ...state,
        filters: {
          ...state.filters,
          tags: [...state.filters.tags, action.valueOrId!],
          untagged: false,
        },
      }

    case QuestionPoolReducerActionType.SET_COURSE_ID:
      return {
        ...state,
        filters: {
          ...state.filters,
          courseId: action.valueOrId as string | undefined,
        },
      }

    case QuestionPoolReducerActionType.SET_ACTIVITY_ID:
      return {
        ...state,
        filters: {
          ...state.filters,
          activityId: action.valueOrId as string | undefined,
        },
      }

    case QuestionPoolReducerActionType.SET_MULTIPLIER:
      return {
        ...state,
        filters: {
          ...state.filters,
          multiplier:
            state.filters.multiplier === action.multiplier
              ? undefined
              : action.multiplier,
          sampleSolution: true,
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

    case QuestionPoolReducerActionType.SAMPLE_SOLUTION:
      return {
        ...state,
        filters: {
          ...state.filters,
          sampleSolution:
            typeof action.newValue !== 'undefined'
              ? action.newValue
              : !state.filters.sampleSolution,
          multiplier: state.filters.sampleSolution
            ? undefined
            : state.filters.multiplier, // reset multiplier if sample solution is disabled
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
      return { ...state, filters: SORTING_FILTERING_INITIAL.filters }

    default:
      return state
  }
}

function useSortingAndFiltering(initialValue: FilterSortType) {
  const [state, dispatch] = useReducer(reducer, initialValue)
  const handleReset = useCallback(
    (): void => dispatch({ type: QuestionPoolReducerActionType.RESET }),
    []
  )
  const toggleCourseIdFilter = useCallback(
    ({ courseId }: { courseId?: string }): void =>
      dispatch({
        type: QuestionPoolReducerActionType.SET_COURSE_ID,
        valueOrId: courseId,
      }),
    []
  )
  const toggleActivityIdFilter = useCallback(
    ({ activityId }: { activityId?: string }): void =>
      dispatch({
        type: QuestionPoolReducerActionType.SET_ACTIVITY_ID,
        valueOrId: activityId,
      }),
    []
  )

  return {
    ...state,
    handleReset,
    handleSortByChange: (by: SortByType): void =>
      dispatch({ type: QuestionPoolReducerActionType.SORT_BY, by }),
    handleSortOrderToggle: (): void =>
      dispatch({ type: QuestionPoolReducerActionType.SORT_ORDER }),
    handleToggleArchive: (): void =>
      dispatch({
        type: QuestionPoolReducerActionType.TOGGLE_ARCHIVE,
        newValue: !state.filters.archive,
      }),
    handleTagClick: ({
      valueOrId,
      isTypeTag,
      isStatusTag,
      isSharingTypeTag,
      isUntagged,
    }: {
      valueOrId: string
      isTypeTag: boolean
      isStatusTag: boolean
      isSharingTypeTag: boolean
      isUntagged: boolean
    }): void =>
      dispatch({
        type: QuestionPoolReducerActionType.TAG_CLICK,
        valueOrId,
        isTypeTag,
        isStatusTag,
        isSharingTypeTag,
        isUntagged,
      }),
    toggleCourseIdFilter,
    toggleActivityIdFilter,
    toggleMultiplierFilter: ({ multiplier }: { multiplier?: number }): void =>
      dispatch({
        type: QuestionPoolReducerActionType.SET_MULTIPLIER,
        multiplier,
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
