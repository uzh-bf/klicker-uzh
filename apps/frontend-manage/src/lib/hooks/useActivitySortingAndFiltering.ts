import {
  ActivityType,
  PublicationStatus,
  ReviewStatus,
  SharingType,
  SortByType,
} from '@klicker-uzh/graphql/dist/ops'
import { useReducer } from 'react'

export type ActivityFilters = {
  status: PublicationStatus[]
  sharingType: SharingType[]
  type?: ActivityType
  course?: string | null // null means "unassigned", undefined means "all courses"
  multiplier?: number | null
  reviewStatus?: ReviewStatus | null
}

export type ActivitySortType = {
  asc: boolean
  by: SortByType
}

enum ActivityReducerActionType {
  TOGGLE_STATUS = 'TOGGLE_STATUS',
  TOGGLE_SHARING_TYPE = 'TOGGLE_SHARING_TYPE',
  SET_ACTIVITY_TYPE = 'SET_ACTIVITY_TYPE',
  SET_COURSE = 'SET_COURSE',
  SET_MULTIPLIER = 'SET_MULTIPLIER',
  SET_REVIEW_STATUS = 'SET_REVIEW_STATUS',
  SORT_ORDER = 'SORT_ORDER',
  SORT_BY = 'SORT_BY',
  RESET = 'RESET',
}

type ActivityFilterSortType = {
  filters: ActivityFilters
  sort: ActivitySortType
}

type ReducerAction = {
  type: ActivityReducerActionType
  status?: PublicationStatus
  sharingType?: SharingType
  activityType?: ActivityType
  course?: string | null
  multiplier?: number | null
  reviewStatus?: ReviewStatus | null
  by?: SortByType
}

export const ACTIVITY_SORTING_FILTERING_INITIAL: ActivityFilterSortType = {
  filters: {
    status: [],
    sharingType: [
      SharingType.Owned,
      SharingType.Shared,
      SharingType.Dependency,
    ],
    type: undefined,
    course: undefined,
    multiplier: undefined,
    reviewStatus: undefined,
  },
  sort: {
    asc: false,
    by: SortByType.Modified,
  },
}

function activityReducer(
  state: ActivityFilterSortType,
  action: ReducerAction
): ActivityFilterSortType {
  switch (action.type) {
    case ActivityReducerActionType.TOGGLE_STATUS:
      if (!action.status) return state

      return {
        ...state,
        filters: {
          ...state.filters,
          status: state.filters.status.includes(action.status)
            ? state.filters.status.filter((s) => s !== action.status)
            : [...state.filters.status, action.status],
        },
      }

    case ActivityReducerActionType.TOGGLE_SHARING_TYPE:
      if (!action.sharingType) return state

      return {
        ...state,
        filters: {
          ...state.filters,
          sharingType: state.filters.sharingType.includes(action.sharingType)
            ? state.filters.sharingType.filter((s) => s !== action.sharingType)
            : [...state.filters.sharingType, action.sharingType],
        },
      }

    case ActivityReducerActionType.SET_ACTIVITY_TYPE:
      return {
        ...state,
        filters: {
          ...state.filters,
          type:
            state.filters.type === action.activityType
              ? undefined
              : action.activityType,
        },
      }

    case ActivityReducerActionType.SET_COURSE:
      return {
        ...state,
        filters: {
          ...state.filters,
          course:
            state.filters.course === action.course ? undefined : action.course,
        },
      }

    case ActivityReducerActionType.SET_MULTIPLIER:
      return {
        ...state,
        filters: {
          ...state.filters,
          multiplier:
            state.filters.multiplier === action.multiplier
              ? undefined
              : action.multiplier,
        },
      }

    case ActivityReducerActionType.SET_REVIEW_STATUS:
      return {
        ...state,
        filters: {
          ...state.filters,
          reviewStatus:
            state.filters.reviewStatus === action.reviewStatus
              ? undefined
              : action.reviewStatus,
        },
      }

    case ActivityReducerActionType.SORT_ORDER:
      return {
        ...state,
        sort: {
          ...state.sort,
          asc: !state.sort.asc,
        },
      }

    case ActivityReducerActionType.SORT_BY:
      return {
        ...state,
        sort: {
          ...state.sort,
          by: action.by!,
        },
      }

    case ActivityReducerActionType.RESET:
      return { ...state, filters: ACTIVITY_SORTING_FILTERING_INITIAL.filters }

    default:
      return state
  }
}

function useActivitySortingAndFiltering(initialValue: ActivityFilterSortType) {
  const [state, dispatch] = useReducer(activityReducer, initialValue)

  return {
    ...state,
    handleReset: (): void =>
      dispatch({ type: ActivityReducerActionType.RESET }),
    handleSortByChange: (by: SortByType): void =>
      dispatch({ type: ActivityReducerActionType.SORT_BY, by }),
    handleSortOrderToggle: (): void =>
      dispatch({ type: ActivityReducerActionType.SORT_ORDER }),
    toggleStatusFilter: (status: PublicationStatus): void =>
      dispatch({
        type: ActivityReducerActionType.TOGGLE_STATUS,
        status,
      }),
    toggleSharingTypeFilter: (sharingType: SharingType): void =>
      dispatch({
        type: ActivityReducerActionType.TOGGLE_SHARING_TYPE,
        sharingType,
      }),
    toggleActivityTypeFilter: (activityType: ActivityType): void =>
      dispatch({
        type: ActivityReducerActionType.SET_ACTIVITY_TYPE,
        activityType,
      }),
    toggleCourseFilter: (course: string | null): void =>
      dispatch({
        type: ActivityReducerActionType.SET_COURSE,
        course,
      }),
    toggleMultiplierFilter: (multiplier: number | null): void =>
      dispatch({
        type: ActivityReducerActionType.SET_MULTIPLIER,
        multiplier,
      }),
    toggleReviewStatusFilter: (reviewStatus: ReviewStatus | null): void =>
      dispatch({
        type: ActivityReducerActionType.SET_REVIEW_STATUS,
        reviewStatus,
      }),
  }
}

export default useActivitySortingAndFiltering
