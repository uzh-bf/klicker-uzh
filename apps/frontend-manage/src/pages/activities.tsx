import { useQuery } from '@apollo/client'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import {
  GetUserActivitiesCoursesDocument,
  GetUserActivitiesDocument,
  SharingType,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { TextField } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ActivityList from '../components/activities/overview/ActivityList'
import ActivityOverviewFilters, {
  ActivityOverviewFilterType,
} from '../components/activities/overview/ActivityOverviewFilters'
import Layout from '../components/Layout'

function Activities() {
  const t = useTranslations()
  const [searchInput, setSearchInput] = useState('')
  const [searchString, setSearchString] = useState('')

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

  // TODO: handle sharing filters through backend as well
  const { loading: loadingActivities, data: dataActivities } = useQuery(
    GetUserActivitiesDocument,
    {
      variables: {
        statusFilter: filters.status,
        activityTypeFilter: filters.type,
        courseId: filters.course !== null ? filters.course : undefined,
        withoutCourse: filters.course === null ? true : undefined,
        searchString: searchString.trim() || undefined,
        showOwned: filters.sharingType.includes(SharingType.Owned),
        showShared: filters.sharingType.includes(SharingType.Shared),
        showDependencies: filters.sharingType.includes(SharingType.Dependency),
      },
      fetchPolicy: 'cache-and-network',
    }
  )

  // const filteredActivities = useMemo(() => {
  //   if (!dataActivities?.userActivities) return []

  //   // apply sharing type filters (if defined)
  //   let filtered = dataActivities.userActivities
  //   filtered = filtered.filter((activity) =>
  //     filters.sharingType?.includes(activity.sharingType)
  //   )

  //   return filtered
  // }, [dataActivities, searchInput, filters.sharingType])

  const filtersActive =
    filters.status.length > 0 ||
    typeof filters.sharingType === 'undefined' ||
    filters.sharingType.length !== 3 ||
    typeof filters.type !== 'undefined' ||
    typeof filters.course !== 'undefined'

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
            <div>
              <div className="mb-2 flex flex-row items-center gap-1">
                <TextField
                  placeholder={t('manage.general.searchPlaceholder')}
                  value={searchInput}
                  onChange={(newValue: string) => {
                    setSearchInput(newValue)

                    if (newValue.trim() === '') {
                      setSearchString('')
                    }
                  }}
                  icon={faMagnifyingGlass}
                  className={{
                    input: 'pl-8! h-10',
                    field: 'w-80 rounded-md pr-3',
                  }}
                  onEnter={() => setSearchString(searchInput)}
                  onReset={() => {
                    setSearchInput('')
                    setSearchString('')
                  }}
                />
                {/* // TODO: introduce customized ordering for activity overview */}
              </div>
            </div>

            <div className="h-full overflow-y-auto">
              {loadingActivities ? (
                <Loader />
              ) : (
                <ActivityList
                  activities={dataActivities?.userActivities ?? []}
                  noActivities={
                    !filtersActive &&
                    dataActivities?.userActivities?.length === 0
                  }
                  highlightedActivity={null}
                />
              )}
            </div>
          </>
        </div>
      </div>
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
