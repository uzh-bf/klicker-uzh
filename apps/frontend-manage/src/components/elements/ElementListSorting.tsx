import { faSortAsc, faSortDesc } from '@fortawesome/free-solid-svg-icons'
import { SortByType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
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

  return (
    <div className="flex flex-row gap-1 pr-3">
      <Button
        disabled={!sort.by}
        onClick={() => {
          handleSortOrderToggle()
        }}
        className={{ root: 'h-10 rounded-md' }}
        data={{ cy: 'sort-order-question-pool-toggle' }}
      >
        <Button.Icon icon={sort.asc ? faSortAsc : faSortDesc} withoutLabel />
      </Button>
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
        className={{ root: 'min-w-30', trigger: 'h-10' }}
        data={{ cy: 'sort-by-question-pool' }}
      />
    </div>
  )
}

export default ElementListSorting
