import { useQuery } from '@apollo/client'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { GetUserActivitiesDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { TextField } from '@uzh-bf/design-system'
import * as JsSearch from 'js-search'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import ActivityList from '../components/activities/overview/ActivityList'
import ActivityOverviewFilters, {
  ActivityOverviewFilterType,
} from '../components/activities/overview/ActivityOverviewFilters'
import Layout from '../components/Layout'

function Activities() {
  const t = useTranslations()
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<ActivityOverviewFilterType>({
    status: [],
  })
  const { loading: loadingActivities, data: dataActivities } = useQuery(
    GetUserActivitiesDocument,
    { fetchPolicy: 'cache-and-network' }
  )

  // setup search
  const search = useMemo(() => {
    if (!dataActivities?.userActivities) {
      return null
    }

    const search = new JsSearch.Search('id')
    search.indexStrategy = new JsSearch.AllSubstringsIndexStrategy()
    search.searchIndex = new JsSearch.UnorderedSearchIndex()
    search.addIndex('name')
    search.addIndex('displayName')
    search.addDocuments(dataActivities.userActivities)
    return search
  }, [dataActivities?.userActivities])

  const filteredActivities = useMemo(() => {
    if (!dataActivities?.userActivities) return []

    // apply search filter (if defined)
    let filtered = dataActivities.userActivities
    if (searchInput.trim() !== '' && search !== null) {
      filtered = search.search(
        searchInput
      ) as typeof dataActivities.userActivities
    }

    // apply status filters (if defined)
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter((activity) =>
        filters.status.includes(activity.status)
      )
    }

    return filtered
  }, [dataActivities, searchInput, search, filters.status])

  return (
    <Layout
      displayName={t('shared.generic.activities')}
      data={{ cy: 'activities-overview' }}
      className={{ children: 'pb-2' }}
    >
      <div className="flex h-full flex-col gap-4 overflow-y-auto md:flex-row">
        {dataActivities && dataActivities.userActivities && (
          <div>
            <ActivityOverviewFilters
              filters={filters}
              setFilters={setFilters}
            />
          </div>
        )}
        <div className="flex w-full flex-1 flex-col overflow-auto">
          <>
            <div className="flex flex-none flex-row content-center items-end justify-between pb-3">
              <div className="flex flex-row items-center gap-1">
                <TextField
                  placeholder={t('manage.general.searchPlaceholder')}
                  value={searchInput}
                  onChange={(newValue: string) => {
                    setSearchInput(newValue)
                  }}
                  icon={faMagnifyingGlass}
                  className={{
                    input: 'h-10 pl-9',
                    field: 'w-80 rounded-md pr-3',
                  }}
                />
                {/* // TODO: introduce customized ordering for activity overview */}
              </div>
            </div>

            <div className="border-uzh-grey-60 h-full overflow-y-auto">
              {loadingActivities ? (
                <Loader />
              ) : (
                <ActivityList
                  activities={filteredActivities}
                  noActivities={dataActivities?.userActivities?.length === 0}
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
