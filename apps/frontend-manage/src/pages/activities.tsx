import { useQuery } from '@apollo/client'
import { faListCheck } from '@fortawesome/free-solid-svg-icons'
import {
  ActivityInfo,
  GetUserActivitiesCoursesDocument,
  GetUserActivitiesDocument,
  SharingType,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ActivityBatchOperationsModal from '../components/activities/overview/ActivityBatchOperationsModal'
import ActivityList from '../components/activities/overview/ActivityList'
import ActivityListSearch from '../components/activities/overview/ActivityListSearch'
import ActivityListSelectAllCheckbox from '../components/activities/overview/ActivityListSelectAllCheckbox'
import ActivityOverviewFilters, {
  ActivityOverviewFilterType,
} from '../components/activities/overview/ActivityOverviewFilters'
import Pagination from '../components/common/Pagination'
import Layout from '../components/Layout'

// number of entries per page for pagination
const PAGE_SIZE = 10

function Activities() {
  const t = useTranslations()
  const [searchString, setSearchString] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [batchOperationsOpen, setBatchOperationsOpen] = useState(false)
  const [selectedActivities, setSelectedActivities] = useState<{
    [elementId: number]: ActivityInfo
  }>({})

  const [filters, setFilters] = useState<ActivityOverviewFilterType>({
    status: [],
    sharingType: [
      SharingType.Owned,
      SharingType.Shared,
      SharingType.Dependency,
    ],
    type: undefined,
    course: undefined,
  })

  // get available courses
  const { data: dataCourses } = useQuery(GetUserActivitiesCoursesDocument)

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

  // reset pagination when filters or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, searchString])

  const filtersActive =
    filters.status.length > 0 ||
    typeof filters.sharingType === 'undefined' ||
    filters.sharingType.length !== 3 ||
    typeof filters.type !== 'undefined' ||
    typeof filters.course !== 'undefined'

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
            setFilters={setFilters}
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
                {/* // TODO: introduce customized ordering for activity overview */}
              </div>
              {user?.privatePreview &&
              Object.keys(selectedActivities).length > 0 ? (
                <Button
                  className={{
                    root: 'mt-0.5 h-8 bg-orange-100 hover:bg-orange-200',
                  }}
                  onClick={() => setBatchOperationsOpen(true)}
                  data={{ cy: 'element-batch-operations' }}
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
                    activities={activities}
                    noActivities={!filtersActive && numOfActivities === 0}
                    highlightedActivity={null}
                    selectedActivities={selectedActivities}
                    setSelectedActivities={setSelectedActivities}
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
