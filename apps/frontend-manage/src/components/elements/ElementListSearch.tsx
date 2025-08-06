import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'

function ElementListSearch({
  setSearchString,
}: {
  setSearchString: Dispatch<SetStateAction<string>>
}) {
  const t = useTranslations()
  const [searchInput, setSearchInput] = useState('')

  return (
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
      className={{ input: 'h-9 pl-8', field: 'w-64 rounded-md pr-3' }}
      onEnter={() => setSearchString(searchInput)}
      onReset={() => {
        setSearchInput('')
        setSearchString('')
      }}
      data={{ cy: 'elements-search-input' }}
    />
  )
}

export default ElementListSearch
