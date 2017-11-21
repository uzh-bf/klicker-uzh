import React from 'react'
import { Dropdown } from 'semantic-ui-react'

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

const LanguageSwitcher = () => (
  <div className="languageSwitcher">
    <Dropdown selection options={languageOptions} placeholder={'Select Language'} />

    <style jsx>{`
      .languageSwitcher {
        margin-top: 20rem;
      }
    `}</style>
  </div>
)

export default LanguageSwitcher
