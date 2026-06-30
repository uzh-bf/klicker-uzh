import { faSortAsc, faSortDesc } from '@fortawesome/free-solid-svg-icons'
import { Button, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { SortByType } from '../../../lib/constants/activityEnums'
import { ActivitySortType } from '../../../lib/hooks/useActivitySortingAndFiltering'

function ActivityListSorting({
  sort,
  handleSortByChange,
  handleSortOrderToggle,
}: {
  sort: ActivitySortType
  handleSortByChange: (newSortBy: SortByType) => void
  handleSortOrderToggle: () => void
}) {
  const t = useTranslations()

  return (
    <div className="flex flex-row gap-1 pr-3">
      <Select
        value={sort.by}
        onChange={(newSortBy) => handleSortByChange(newSortBy as SortByType)}
        placeholder={t('manage.general.sortBy')}
        contentPosition="popper"
        items={[
          {
            value: SortByType.Title,
            label: t('manage.general.title'),
            data: { cy: 'sort-by-activity-title' },
          },
          {
            value: SortByType.Type,
            label: t('manage.general.activityType'),
            data: { cy: 'sort-by-activity-type' },
          },
          {
            value: SortByType.Status,
            label: t('manage.general.status'),
            data: { cy: 'sort-by-activity-status' },
          },
          {
            value: SortByType.Created,
            label: t('manage.general.dateCreated'),
            data: { cy: 'sort-by-activity-created' },
          },
          {
            value: SortByType.Modified,
            label: t('manage.general.dateModified'),
            data: { cy: 'sort-by-activity-modified' },
          },
        ]}
        className={{ root: 'w-46', trigger: 'h-9' }}
        data={{ cy: 'sort-by-activity' }}
      />
      <Button
        disabled={!sort.by}
        onClick={() => {
          handleSortOrderToggle()
        }}
        className={{ root: 'h-9 w-9 rounded-md' }}
        data={{ cy: 'sort-order-activity-toggle' }}
      >
        <Button.Icon icon={sort.asc ? faSortAsc : faSortDesc} withoutLabel />
      </Button>
    </div>
  )
}

export default ActivityListSorting
