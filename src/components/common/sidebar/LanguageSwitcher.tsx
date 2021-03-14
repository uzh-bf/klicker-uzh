import React from 'react'
import { Dropdown } from 'semantic-ui-react'
import useCookie from '../../../lib/hooks/useCookie'

const languageOptions = [
  {
    flag: 'gb',
    key: 'en',
    text: 'English',
    value: 'en',
  },
  {
    flag: 'de',
    key: 'de',
    text: 'Deutsch',
    value: 'de',
  },
]

function LanguageSwitcher(): React.ReactElement {
  const [locale, setLocale] = useCookie({ cookieName: 'locale', initialValue: 'en', reloadLocation: true })
  return (
    <div className="languageSwitcher">
      <Dropdown
        fluid
        search
        selection
        defaultValue={locale}
        options={languageOptions}
        placeholder="Select Language"
        onChange={(_, data): void => setLocale(data.value)}
      />
    </div>
  )
}

export default LanguageSwitcher
