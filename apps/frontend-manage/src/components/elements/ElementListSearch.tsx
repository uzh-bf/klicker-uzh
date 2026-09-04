import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { type Dispatch, type SetStateAction, useRef } from 'react'
import useFindShortcutFocus from '../../lib/hooks/useFindShortcutFocus'

function ElementListSearch({
  value,
  onValueChange,
  onApplySearch,
}: {
  value: string
  onValueChange: Dispatch<SetStateAction<string>>
  onApplySearch: (value: string) => void
}) {
  const t = useTranslations()
  const containerRef = useRef<HTMLDivElement>(null)
  useFindShortcutFocus({ ref: containerRef })

  return (
    <div ref={containerRef}>
      <TextField
        placeholder={t('manage.general.searchPlaceholder')}
        value={value}
        onChange={(newValue: string) => {
          onValueChange(newValue)

          if (newValue.trim() === '') {
            onApplySearch('')
          }
        }}
        icon={faMagnifyingGlass}
        className={{ input: 'h-9 pl-8', field: 'w-64 rounded-md' }}
        onEnter={() => onApplySearch(value)}
        onReset={() => {
          onValueChange('')
          onApplySearch('')
        }}
        data={{ cy: 'elements-search-input' }}
      />
    </div>
  )
}

export default ElementListSearch
