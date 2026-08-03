import { faSortAsc, faSortDesc } from '@fortawesome/free-solid-svg-icons'
import { SortByType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useId } from 'react'
import { LibrarySortType } from '../../lib/hooks/useSortingAndFiltering'

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
  const sortById = useId()

  return (
    <div className="flex flex-row gap-1 pr-3">
      <div>
        <label className="sr-only" htmlFor={sortById}>
          {t('manage.general.sortBy')}
        </label>
        <Select
          id={sortById}
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
      </div>
      <Button
        disabled={!sort.by}
        onClick={() => {
          handleSortOrderToggle()
        }}
        className={{ root: 'h-9 w-9 rounded-md' }}
        data={{ cy: 'sort-order-question-pool-toggle' }}
        aria-label={t(
          sort.asc
            ? 'manage.general.sortDescending'
            : 'manage.general.sortAscending'
        )}
      >
        <Button.Icon icon={sort.asc ? faSortAsc : faSortDesc} withoutLabel />
      </Button>
    </div>
  )
}

export default ElementListSorting
