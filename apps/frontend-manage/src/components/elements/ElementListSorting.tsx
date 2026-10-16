import { faSortAsc, faSortDesc } from '@fortawesome/free-solid-svg-icons'
import { SortByType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { LibrarySortType } from '../../lib/hooks/useSortingAndFiltering'
import IconActionTooltip from './IconActionTooltip'

function ElementListSorting({
  sort,
  handleSortByChange,
  handleSortOrderToggle,
}: {
  sort: LibrarySortType
  handleSortByChange: (newSortBy: SortByType) => void
  handleSortOrderToggle: () => void
}) {
  const t = useTranslations()
  // The sort button describes the action it triggers: with the list sorted
  // ascending, activating it sorts descending and vice versa.
  const sortOrderLabel = sort.asc
    ? t('manage.general.sortOrderDescending')
    : t('manage.general.sortOrderAscending')

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
            data: { cy: 'sort-by-question-pool-title' },
          },
          {
            value: SortByType.Type,
            label: t('manage.general.elementType'),
            data: { cy: 'sort-by-question-pool-type' },
          },
          {
            value: SortByType.Status,
            label: t('manage.general.status'),
            data: { cy: 'sort-by-question-pool-status' },
          },
          {
            value: SortByType.Created,
            label: t('manage.general.dateCreated'),
            data: { cy: 'sort-by-question-pool-created' },
          },
          {
            value: SortByType.Modified,
            label: t('manage.general.dateModified'),
            data: { cy: 'sort-by-question-pool-modified' },
          },
        ]}
        className={{ root: 'w-46', trigger: 'h-9' }}
        data={{ cy: 'sort-by-question-pool' }}
      />
      <IconActionTooltip label={sortOrderLabel}>
        <Button
          disabled={!sort.by}
          onClick={() => {
            handleSortOrderToggle()
          }}
          aria-label={sortOrderLabel}
          className={{ root: 'h-9 w-9 rounded-md' }}
          data={{ cy: 'sort-order-question-pool-toggle' }}
        >
          <Button.Icon icon={sort.asc ? faSortAsc : faSortDesc} withoutLabel />
        </Button>
      </IconActionTooltip>
    </div>
  )
}

export default ElementListSorting
