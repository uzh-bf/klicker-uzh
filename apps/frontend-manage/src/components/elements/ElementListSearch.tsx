import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useRef, useState } from 'react'
import useFindShortcutFocus from '../../lib/hooks/useFindShortcutFocus'

function ElementListSearch({
  setSearchString,
}: {
  setSearchString: Dispatch<SetStateAction<string>>
}) {
  const t = useTranslations()
  const [searchInput, setSearchInput] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  useFindShortcutFocus({ ref: containerRef })

  return (
    <div ref={containerRef}>
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
        className={{ input: 'h-9 pl-8', field: 'w-64 rounded-md' }}
        onEnter={() => setSearchString(searchInput)}
        onReset={() => {
          setSearchInput('')
          setSearchString('')
        }}
        data={{ cy: 'elements-search-input' }}
      />
    </div>
  )
}

export default ElementListSearch
