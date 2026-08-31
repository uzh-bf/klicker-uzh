import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react'
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

  // Apply non-empty searches after a short pause; Enter applies immediately,
  // and clearing the input resets the applied query right away.
  useEffect(() => {
    if (value.trim() === '') {
      return
    }

    const timeout = setTimeout(() => {
      onApplySearch(value)
    }, 300)

    return () => clearTimeout(timeout)
  }, [value, onApplySearch])

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
