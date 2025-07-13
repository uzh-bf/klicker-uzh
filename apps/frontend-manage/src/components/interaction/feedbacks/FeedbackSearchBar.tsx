import { faMagnifyingGlass, faPrint } from '@fortawesome/free-solid-svg-icons'
import { Button, Select, TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface FeedbackSearchBarProps {
  searchString: string
  setSearchString: (searchString: string) => void
  sortBy: string
  setSortBy: (sortBy: string) => void
  disabled?: {
    search?: boolean
    sorting?: boolean
    print?: boolean
  }
  className?: string
}

function FeedbackSearchBar({
  searchString,
  setSearchString,
  sortBy,
  setSortBy,
  disabled,
  className,
}: FeedbackSearchBarProps) {
  const t = useTranslations()

  return (
    <div
      className={twMerge(
        'flex w-full flex-row flex-wrap items-center justify-between gap-2 print:hidden',
        className
      )}
    >
      <TextField
        disabled={disabled?.search}
        value={searchString}
        onChange={(newValue: string) => setSearchString(newValue)}
        placeholder={t('manage.general.searchPlaceholder')}
        icon={faMagnifyingGlass}
        className={{
          input: 'pl-8! h-10',
          field: 'w-80 rounded-md pr-3',
        }}
      />

      <div className="flex flex-row gap-2">
        <Button
          className={{
            root: twMerge('h-9 w-9'),
          }}
          onClick={() => window.print()}
          disabled={disabled?.print}
          data={{ cy: 'print-feedback-channel-button' }}
        >
          <Button.Icon withoutLabel icon={faPrint} />
        </Button>

        <Select
          disabled={disabled?.sorting}
          value={sortBy}
          items={[
            {
              value: 'votes',
              label: t('manage.cockpit.sortByVotes'),
              data: { cy: 'sort-by-votes' },
            },
            {
              value: 'recency',
              label: t('manage.cockpit.sortByTime'),
              data: { cy: 'sort-by-time' },
            },
          ]}
          onChange={(newValue: string) => setSortBy(newValue)}
          data={{ cy: 'sort-feedback-channel-select' }}
          className={{ trigger: 'h-9' }}
        />
      </div>
    </div>
  )
}

export default FeedbackSearchBar
