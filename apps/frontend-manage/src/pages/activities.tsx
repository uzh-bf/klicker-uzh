import { useQuery } from '@apollo/client'
import { faListCheck } from '@fortawesome/free-solid-svg-icons'
import {
  ActivityInfo,
  ActivityType,
  GetUserActivitiesCoursesDocument,
  GetUserActivitiesDocument,
  PublicationStatus,
  SharingType,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import ActivityBatchOperationsModal from '../components/activities/overview/ActivityBatchOperationsModal'
import ActivityList from '../components/activities/overview/ActivityList'
import ActivityListSearch from '../components/activities/overview/ActivityListSearch'
import ActivityListSelectAllCheckbox from '../components/activities/overview/ActivityListSelectAllCheckbox'
import ActivityListSorting from '../components/activities/overview/ActivityListSorting'
import ActivityOverviewFilters from '../components/activities/overview/ActivityOverviewFilters'
import ActivityDetailsModal from '../components/activities/overview/details/ActivityDetailsModal'
import Pagination from '../components/common/Pagination'
import Layout from '../components/Layout'
import useActivitySortingAndFiltering, {
  ACTIVITY_SORTING_FILTERING_INITIAL,
} from '../lib/hooks/useActivitySortingAndFiltering'

// number of entries per page for pagination
const PAGE_SIZE = 10

function Activities() {
  const t = useTranslations()
  const router = useRouter()

  const [searchString, setSearchString] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [batchOperationsOpen, setBatchOperationsOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedActivities, setSelectedActivities] = useState<{
    [activityId: string]: ActivityInfo
  }>({})

  // initialize the sorting and filtering state from local storage (if available)
  const [storedFiltering, _] = useState(() => {
    // only try to access localStorage if we're on the client
    if (typeof window !== 'undefined') {
      try {
        const savedFilters = localStorage.getItem(
          'activities-filtering-sorting'
        )
        if (savedFilters) {
          return JSON.parse(savedFilters)
        }
      } catch (error) {
        console.error('Error loading stored filters from localStorage', error)
      }
    }
    return ACTIVITY_SORTING_FILTERING_INITIAL
  })

  const {
    filters,
    sort,
    handleReset,
    handleSortByChange,
    handleSortOrderToggle,
    toggleStatusFilter,
    toggleSharingTypeFilter,
    toggleActivityTypeFilter,
    toggleCourseFilter,
    toggleMultiplierFilter,
    toggleReviewStatusFilter,
  } = useActivitySortingAndFiltering(storedFiltering)

  // get available courses
  const { data: dataCourses } = useQuery(GetUserActivitiesCoursesDocument, {
    fetchPolicy: 'cache-and-network',
  })

  // get the user data to check for the private preview flag
  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const user = dataUser?.userProfile

  // get user activities while respecting the corresponding filters and pagination
  const {
    loading: loadingActivities,
    data: dataActivities,
    refetch: refetchActivities,
  } = useQuery(GetUserActivitiesDocument, {
    variables: {
      statusFilter: filters.status,
      activityTypeFilter: filters.type,
      courseId: filters.course !== null ? filters.course : undefined,
      withoutCourse: filters.course === null ? true : undefined,
      searchString: searchString.trim() || undefined,
      showOwned: filters.sharingType.includes(SharingType.Owned),
      showShared: filters.sharingType.includes(SharingType.Shared),
      showDependencies: filters.sharingType.includes(SharingType.Dependency),
      multiplier: filters.multiplier ?? undefined,
      reviewStatus: filters.reviewStatus ?? undefined,
      sortByType: sort.by,
      sortByAsc: sort.asc,
      numEntries: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    },
    fetchPolicy: 'network-only',
  })
  const numOfActivities = dataActivities?.userActivities?.numOfActivities || 0
  const activities = dataActivities?.userActivities?.activities || []

  // reset pagination if activities length changes and current page would be out of bounds
  useEffect(() => {
    if (loadingActivities) return

    const maxPage = Math.max(1, Math.ceil(numOfActivities / PAGE_SIZE))
    if (currentPage > maxPage) {
      setCurrentPage(maxPage)
    }
  }, [loadingActivities, numOfActivities, currentPage])

  // reset pagination when filters, search, or sorting changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, searchString, sort])

  // when the shown activities change, make sure the selected activities are still valid
  useEffect(() => {
    setSelectedActivities((prev) => {
      const updatedSelection = { ...prev }
      let changed = false

      Object.keys(updatedSelection).forEach((id) => {
        if (
          !activities.some(
            (act) =>
              act.id === id &&
              (act.status === PublicationStatus.Draft ||
                act.status === PublicationStatus.Scheduled)
          )
        ) {
          delete updatedSelection[id]
          changed = true
        }
      })

      // only update state if something actually changed to avoid render loop
      return changed ? updatedSelection : prev
    })
  }, [activities])

  // if the filters or sorting state changes, save it to local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const newState = { filters, sort }
        // only save if there are actual changes
        const currentStored = localStorage.getItem(
          'activities-filtering-sorting'
        )
        if (!currentStored || JSON.stringify(newState) !== currentStored) {
          localStorage.setItem(
            'activities-filtering-sorting',
            JSON.stringify(newState)
          )
        }
      } catch (error) {
        console.error('Error saving filters to localStorage', error)
      }
    }
  }, [filters, sort])

  // if passed through the query arguments, open the activity details dialog
  useEffect(() => {
    if (
      router.query.openActivityDetailsId &&
      router.query.openActivityDetailsType
    ) {
      setShowDetails(true)
    }
  }, [router.query.openActivityDetailsId, router.query.openActivityDetailsType])

  const filtersActive =
    filters.status.length > 0 ||
    typeof filters.sharingType === 'undefined' ||
    filters.sharingType.length !== 3 ||
    typeof filters.type !== 'undefined' ||
    typeof filters.course !== 'undefined' ||
    typeof filters.multiplier !== 'undefined' ||
    typeof filters.reviewStatus !== 'undefined'

  // compute the number of total pagination pages
  const totalPages = Math.max(1, Math.ceil(numOfActivities / PAGE_SIZE))

  return (
    <Layout
      displayName={t('shared.generic.activities')}
      data={{ cy: 'activities-overview' }}
      className={{ children: 'pb-2' }}
    >
      <div className="flex h-full flex-col gap-4 overflow-y-auto md:flex-row">
        <div>
          <ActivityOverviewFilters
            filters={filters}
            toggleStatusFilter={toggleStatusFilter}
            toggleSharingTypeFilter={toggleSharingTypeFilter}
            toggleActivityTypeFilter={toggleActivityTypeFilter}
            toggleCourseFilter={toggleCourseFilter}
            toggleMultiplierFilter={toggleMultiplierFilter}
            toggleReviewStatusFilter={toggleReviewStatusFilter}
            handleReset={handleReset}
            availableCourses={dataCourses?.getUserActivitiesCourses ?? []}
            filtersActive={filtersActive}
          />
        </div>
        <div className="flex w-full flex-1 flex-col overflow-auto">
          <>
            <div className="flex flex-row items-start justify-between">
              <div className="mb-2 flex flex-row items-center gap-1.5">
                {user?.privatePreview && (
                  <ActivityListSelectAllCheckbox
                    activities={activities}
                    selectedActivities={selectedActivities}
                    setSelectedActivities={setSelectedActivities}
                  />
                )}
                <ActivityListSearch setSearchString={setSearchString} />
                <ActivityListSorting
                  sort={sort}
                  handleSortByChange={handleSortByChange}
                  handleSortOrderToggle={handleSortOrderToggle}
                />
              </div>
              {user?.privatePreview &&
              Object.keys(selectedActivities).length > 0 ? (
                <Button
                  className={{
                    root: 'h-8.5 mt-0.5 border-orange-300 bg-orange-100 hover:border-orange-400 hover:bg-orange-200 hover:text-orange-900',
                  }}
                  onClick={() => setBatchOperationsOpen(true)}
                  data={{ cy: 'activity-batch-operations' }}
                >
                  <Button.Icon icon={faListCheck} />
                  <Button.Label>
                    {t('manage.activities.batchOperations', {
                      numActivities: Object.keys(selectedActivities).length,
                    })}
                  </Button.Label>
                </Button>
              ) : null}
            </div>

            <div className="h-full overflow-y-auto">
              {loadingActivities ? (
                <Loader />
              ) : (
                <>
                  <ActivityList
                    filtersActive={filtersActive}
                    activities={activities}
                    noActivities={!filtersActive && numOfActivities === 0}
                    highlightedActivity={null}
                    selectedActivities={selectedActivities}
                    setSelectedActivities={setSelectedActivities}
                    handleFilterReset={handleReset}
                    refetchActivities={async () => {
                      await refetchActivities()
                    }}
                  />

                  {activities.length > 0 && totalPages > 1 && (
                    <Pagination
                      totalPages={totalPages}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                      numOfObjects={numOfActivities}
                      PAGE_SIZE={PAGE_SIZE}
                      className="mb-3"
                    />
                  )}
                </>
              )}
            </div>
          </>
        </div>
      </div>

      {showDetails &&
      router.query.openActivityDetailsId &&
      router.query.openActivityDetailsType ? (
        <ActivityDetailsModal
          activityId={router.query.openActivityDetailsId as string}
          activityType={router.query.openActivityDetailsType as ActivityType}
          onClose={() => {
            // close the modal
            setShowDetails(false)

            // unset the edit open activity id (if defined)
            const { openActivityDetailsId, openActivityDetailsType, ...query } =
              router.query
            router.push({ pathname: '/activities', query }, undefined, {
              shallow: true,
            })
          }}
          refetchActivities={async () => {
            await refetchActivities()
          }}
        />
      ) : null}
      {user?.privatePreview && batchOperationsOpen ? (
        <ActivityBatchOperationsModal
          selectedActivities={Object.values(selectedActivities)}
          onClose={() => setBatchOperationsOpen(false)}
          resetSelectedActivities={() => setSelectedActivities({})}
          refetchActivities={async () => {
            await refetchActivities()
          }}
        />
      ) : null}
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Activities
